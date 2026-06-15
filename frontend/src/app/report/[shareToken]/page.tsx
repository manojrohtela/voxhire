"use client";

import { useEffect, useState } from "react";
import { interviewsApi } from "@/lib/api-client";
import InterviewReportView, { ReportData } from "@/components/InterviewReportView";

export default function SharedReportPage({ params }: { params: { shareToken: string } }) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    interviewsApi
      .getSharedReport(params.shareToken)
      .then((data) => setReport(data as ReportData))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-surface border border-base flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-foreground-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        </div>
        <h1 className="text-foreground text-lg font-semibold mb-1">Report unavailable</h1>
        <p className="text-foreground-3 text-sm max-w-sm">
          This shared report link is invalid or has been disabled by the recruiter.
        </p>
        <a
          href="https://voxhire.heyagenthive.com"
          className="mt-6 inline-flex items-center gap-2 text-primary text-sm hover:underline"
        >
          Learn about VoxHire →
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Branded public header */}
      <div className="border-b border-base bg-surface px-6 py-3 flex items-center gap-3 sticky top-0 z-20">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">V</div>
        <span className="text-foreground font-semibold text-sm">VoxHire</span>
        <span className="text-foreground-4 text-xs">· Interview Report</span>
        {report.org_name && (
          <span className="ml-auto text-foreground-3 text-xs">Prepared by {report.org_name}</span>
        )}
      </div>

      <InterviewReportView report={report} publicBranding />
    </div>
  );
}
