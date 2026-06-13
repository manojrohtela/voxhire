/**
 * VoxHire API Client
 * All API calls go through here — handles auth headers + token refresh
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // Try token refresh on 401
  if (res.status === 401) {
    const refresh = localStorage.getItem("refresh_token");
    if (refresh) {
      const refreshRes = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        localStorage.setItem("access_token", data.access_token);
        // Retry
        const retry = await fetch(`${API_URL}${path}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.access_token}`,
            ...options.headers,
          },
        });
        if (!retry.ok) throw new Error(await retry.text());
        return retry.json();
      }
    }
    if (typeof window !== "undefined") window.location.href = "/auth/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    const error: any = new Error(
      typeof err.detail === "string" ? err.detail : (err.detail?.message ?? "Request failed")
    );
    error.status = res.status;
    error.detail = err.detail;
    throw error;
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────
export const authApi = {
  signup: (body: { org_name: string; admin_name: string; email: string; password: string }) =>
    request("/api/v1/auth/signup", { method: "POST", body: JSON.stringify(body) }),

  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string; user: any }>(
      "/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }
    ),

  me: () => request<any>("/api/v1/auth/me"),

  inviteRecruiter: (email: string, name: string) =>
    request("/api/v1/auth/invite", { method: "POST", body: JSON.stringify({ email, name }) }),

  listRecruiters: () => request<any[]>("/api/v1/auth/recruiters"),
};

// ─── Candidates ───────────────────────────────────────────────
export const candidatesApi = {
  list: (params?: { search?: string; rating?: string; skip?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.rating) q.set("rating", params.rating);
    if (params?.skip !== undefined) q.set("skip", String(params.skip));
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    return request<{ candidates: any[]; total: number }>(`/api/v1/candidates?${q}`);
  },

  get: (id: string) => request<any>(`/api/v1/candidates/${id}`),

  create: (body: any) =>
    request<any>("/api/v1/candidates", { method: "POST", body: JSON.stringify(body) }),

  update: (id: string, body: any) =>
    request<any>(`/api/v1/candidates/${id}`, { method: "PUT", body: JSON.stringify(body) }),

  delete: (id: string) =>
    request(`/api/v1/candidates/${id}`, { method: "DELETE" }),

  saveSkills: (id: string, skills: any[]) =>
    request(`/api/v1/candidates/${id}/skills`, { method: "POST", body: JSON.stringify({ skills }) }),
};

// ─── Interviews ───────────────────────────────────────────────
export const interviewsApi = {
  list: (status?: string) => {
    const q = status ? `?status=${status}` : "";
    return request<any[]>(`/api/v1/interviews${q}`);
  },

  get: (id: string) => request<any>(`/api/v1/interviews/${id}`),

  create: (body: {
    candidate_id: string;
    scheduled_at?: string;
    duration_minutes?: number;
    interview_type?: string;
    language?: string;
    difficulty?: string;
    question_strategy?: string;
    ai_personality?: string;
    focus_skills?: string[];
  }) => request<any>("/api/v1/interviews", { method: "POST", body: JSON.stringify(body) }),

  updateConfig: (id: string, body: {
    custom_job_title?: string;
    interview_type?: string;
    difficulty?: string;
    ai_personality?: string;
    duration_minutes?: number;
    focus_skills?: string[];
  }) => request<any>(`/api/v1/interviews/${id}/config`, { method: "PATCH", body: JSON.stringify(body) }),

  // Recruiter-side status update (JWT auth)
  updateStatus: (id: string, status: string) =>
    request(`/api/v1/interviews/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),

  saveEvaluation: (id: string, body: any) =>
    request(`/api/v1/interviews/${id}/evaluation`, { method: "POST", body: JSON.stringify(body) }),

  // Candidate-side: authenticated by link_token header
  appendTranscript: (sessionId: string, entries: any[], linkToken: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    return fetch(`${API_URL}/api/v1/interviews/${sessionId}/transcript`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Interview-Token": linkToken,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ entries }),
    }).then((r) => (r.ok ? r.json() : Promise.reject(r)));
  },

  recordViolation: (sessionId: string, violation_type: string, linkToken: string, timestamp_seconds?: number) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    return fetch(`${API_URL}/api/v1/interviews/${sessionId}/violations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Interview-Token": linkToken,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ violation_type, timestamp_seconds }),
    }).then((r) => (r.ok ? r.json() : Promise.reject(r)));
  },

  // Candidate-side status update — authenticated by link_token in URL path (no JWT)
  updateStatusByToken: (linkToken: string, status: string) =>
    fetch(`${API_URL}/api/v1/interviews/session/${linkToken}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((r) => (r.ok ? r.json() : Promise.reject(r))),

  join: (linkToken: string) => request<any>(`/api/v1/interviews/join/${linkToken}`),
};

// ─── Job Descriptions ─────────────────────────────────────────
export const jobsApi = {
  list: () => request<any[]>("/api/v1/jobs"),

  get: (id: string) => request<any>(`/api/v1/jobs/${id}`),

  create: (body: { title: string; raw_text: string }) =>
    request<any>("/api/v1/jobs", { method: "POST", body: JSON.stringify(body) }),

  update: (id: string, body: { title?: string; raw_text?: string }) =>
    request<any>(`/api/v1/jobs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  delete: (id: string) =>
    request(`/api/v1/jobs/${id}`, { method: "DELETE" }),
};

// ─── Resume ───────────────────────────────────────────────────
export const resumeApi = {
  parse: async (file: File) => {
    const token = localStorage.getItem("access_token");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/api/v1/resume/parse`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Parse failed" }));
      throw new Error(err.detail);
    }
    return res.json();
  },
};
