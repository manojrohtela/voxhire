"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { interviewsApi } from "@/lib/api-client";
import InterviewReportView, { ReportData } from "@/components/InterviewReportView";

interface InterviewReport extends ReportData {
  id: string;
  candidate_id: string;
  share_token: string | null;
}

// ─── Share control ───────────────────────────────────────────────────────────

function ShareButton({ interviewId, initialToken }: { interviewId: string; initialToken: string | null }) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const buildUrl = (t: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/report/${t}` : "";

  useEffect(() => {
    if (initialToken) setUrl(buildUrl(initialToken));
  }, [initialToken]);

  const enableShare = async () => {
    setLoading(true);
    try {
      const res = await interviewsApi.createShareLink(interviewId);
      setToken(res.share_token);
      setUrl(res.share_url || buildUrl(res.share_token));
    } catch {
      /* surfaced via disabled state */
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — link is still visible to copy manually */
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      await interviewsApi.revokeShareLink(interviewId);
      setToken(null);
      setUrl("");
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <button
        onClick={enableShare}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        {loading ? "Generating…" : "Share report"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 max-w-xl">
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="flex-1 px-3 py-2 rounded-xl bg-surface-hi border border-base text-foreground-2 text-xs font-mono truncate"
        />
        <button
          onClick={copy}
          className="px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-foreground-4">Anyone with this link can view the report (no login).</span>
        <button onClick={disable} disabled={loading} className="text-red-400 hover:underline disabled:opacity-50">
          Disable link
        </button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InterviewReportPage({ params }: { params: { interviewId: string } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingCount, setPollingCount] = useState(0);

  const fetchReport = useCallback(async () => {
    try {
      const data = await interviewsApi.get(params.interviewId);
      setReport(data as InterviewReport);
      setError(null);
      return data;
    } catch (e: any) {
      setError(e?.message || "Failed to load report");
      return null;
    }
  }, [params.interviewId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/auth/login"); return; }
    fetchReport().finally(() => setLoading(false));
  }, [authLoading, user, fetchReport, router]);

  // Poll while evaluation is processing
  useEffect(() => {
    if (!report || report.evaluation_status === "complete" || report.evaluation_status === "failed") return;
    if (pollingCount > 30) return; // stop after 5 minutes
    const timer = setTimeout(() => {
      fetchReport();
      setPollingCount((n) => n + 1);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [report, pollingCount, fetchReport]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-4">{error || "Report not found"}</p>
          <button onClick={() => router.back()} className="text-primary text-sm underline">Go back</button>
        </div>
      </div>
    );
  }

  const isProcessing = report.evaluation_status === "processing";

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Top nav */}
      <div className="border-b border-base bg-surface px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <button onClick={() => router.back()} className="text-foreground-3 hover:text-foreground transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="w-px h-4 bg-ink/10" />
        <span className="text-foreground-3 text-sm">Interview Report</span>
        <div className="ml-auto flex items-center gap-2">
          {isProcessing && (
            <div className="flex items-center gap-2 text-amber-400 text-xs">
              <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
              Evaluation in progress...
            </div>
          )}
        </div>
      </div>

      <InterviewReportView
        report={report}
        headerActions={<ShareButton interviewId={report.id} initialToken={report.share_token} />}
      />
    </div>
  );
}
