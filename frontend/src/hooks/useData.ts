"use client";

import { useState, useEffect, useCallback } from "react";
import { candidatesApi, interviewsApi } from "@/lib/api-client";

// ─── useCandidates ────────────────────────────────────────────
export function useCandidates(params?: { search?: string; rating?: string }) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await candidatesApi.list(params);
      setCandidates(data.candidates);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [params?.search, params?.rating]);

  useEffect(() => { fetch(); }, [fetch]);
  return { candidates, total, loading, error, refetch: fetch };
}

// ─── useCandidate ─────────────────────────────────────────────
export function useCandidate(id: string) {
  const [candidate, setCandidate] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await candidatesApi.get(id);
      setCandidate(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);
  return { candidate, loading, error, refetch: fetch };
}

// ─── useInterviews ────────────────────────────────────────────
export function useInterviews(status?: string) {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await interviewsApi.list(status);
      setInterviews(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { fetch(); }, [fetch]);
  return { interviews, loading, error, refetch: fetch };
}

// ─── useDashboardStats ────────────────────────────────────────
export function useDashboardStats() {
  const [stats, setStats] = useState({
    totalCandidates: 0,
    interviewsDone: 0,
    strongCandidates: 0,
    pendingSchedule: 0,
    ratingBreakdown: { Strong: 0, Medium: 0, Weak: 0, Pending: 0, Scheduled: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [candidatesData, interviewsData] = await Promise.all([
          candidatesApi.list({ limit: 200 }),
          interviewsApi.list(),
        ]);

        const candidates = candidatesData.candidates;
        const breakdown = { Strong: 0, Medium: 0, Weak: 0, Pending: 0, Scheduled: 0 };

        candidates.forEach((c: any) => {
          const rating = c.overall_rating || "Pending";
          if (rating in breakdown) breakdown[rating as keyof typeof breakdown]++;
        });

        // Check scheduled interviews
        const scheduled = interviewsData.filter((i: any) =>
          i.status === "scheduled" || i.status === "in_progress"
        ).length;

        const done = interviewsData.filter((i: any) =>
          i.status === "completed" || i.status === "terminated"
        ).length;

        setStats({
          totalCandidates: candidatesData.total,
          interviewsDone: done,
          strongCandidates: breakdown.Strong,
          pendingSchedule: candidates.filter((c: any) => !c.overall_rating).length,
          ratingBreakdown: breakdown,
        });
      } catch (e) {
        console.error("Failed to load dashboard stats:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { stats, loading };
}
