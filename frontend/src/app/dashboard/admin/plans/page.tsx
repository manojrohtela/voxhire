"use client";

import { useCallback, useEffect, useState } from "react";
import { apiWithAuth } from "@/lib/auth";
import { Button, Card, Input, Field, Badge, Modal, LoadingScreen, EmptyState, SegmentedControl } from "@/components/ui";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price_cents: number;
  currency: string;
  billing_period: string;
  max_interviews_per_month: number | null;
  max_users: number | null;
  features: string[];
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
}

interface OrgRow { id: string; name: string; }

const blank = {
  name: "", slug: "", description: "", price_rupees: "0", currency: "INR",
  billing_period: "monthly", max_interviews_per_month: "", max_users: "",
  features: "", is_active: true, is_public: true,
};

function rupees(cents: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(cents / 100);
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Assignment panel
  const [assignOrg, setAssignOrg] = useState("");
  const [assignPlan, setAssignPlan] = useState("");
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, o] = await Promise.all([
      apiWithAuth("/api/v1/billing/admin/plans").then((r) => r.json()),
      apiWithAuth("/api/v1/admin/orgs").then((r) => r.json()).catch(() => []),
    ]);
    setPlans(Array.isArray(p) ? p : []);
    setOrgs(Array.isArray(o) ? o : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ ...blank }); setEditing("new"); setErr(null); };
  const openEdit = (p: Plan) => {
    setForm({
      name: p.name, slug: p.slug, description: p.description || "",
      price_rupees: String(p.price_cents / 100), currency: p.currency,
      billing_period: p.billing_period,
      max_interviews_per_month: p.max_interviews_per_month == null ? "" : String(p.max_interviews_per_month),
      max_users: p.max_users == null ? "" : String(p.max_users),
      features: (p.features || []).join(", "),
      is_active: p.is_active, is_public: p.is_public,
    });
    setEditing(p); setErr(null);
  };

  const save = async () => {
    setSaving(true); setErr(null);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      description: form.description.trim() || null,
      price_cents: Math.round(parseFloat(form.price_rupees || "0") * 100),
      currency: form.currency, billing_period: form.billing_period,
      max_interviews_per_month: form.max_interviews_per_month === "" ? null : Number(form.max_interviews_per_month),
      max_users: form.max_users === "" ? null : Number(form.max_users),
      features: form.features.split(",").map((s) => s.trim()).filter(Boolean),
      is_active: form.is_active, is_public: form.is_public,
    };
    try {
      const isNew = editing === "new";
      const res = await apiWithAuth(
        isNew ? "/api/v1/billing/admin/plans" : `/api/v1/billing/admin/plans/${(editing as Plan).id}`,
        { method: isNew ? "POST" : "PATCH", body: JSON.stringify(payload) }
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Save failed");
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Plan) => {
    if (!confirm(`Delete plan "${p.name}"?`)) return;
    const res = await apiWithAuth(`/api/v1/billing/admin/plans/${p.id}`, { method: "DELETE" });
    if (!res.ok) { alert((await res.json().catch(() => ({}))).detail || "Delete failed"); return; }
    load();
  };

  const assign = async () => {
    if (!assignOrg || !assignPlan) return;
    setAssignMsg(null);
    const res = await apiWithAuth(`/api/v1/billing/admin/orgs/${assignOrg}/subscription`, {
      method: "PUT", body: JSON.stringify({ plan_id: assignPlan }),
    });
    if (!res.ok) { setAssignMsg((await res.json().catch(() => ({}))).detail || "Assign failed"); return; }
    const data = await res.json();
    setAssignMsg(`✓ ${orgs.find((o) => o.id === assignOrg)?.name} → ${data.plan?.name}`);
  };

  if (plans === null) return <LoadingScreen label="Loading plans…" />;

  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-20 px-7 py-4 border-b border-faint bg-background/90 backdrop-blur flex items-center justify-between">
        <div>
          <h1 className="text-foreground font-semibold text-lg tracking-tight">Subscription Plans</h1>
          <p className="text-foreground-4 text-xs mt-0.5">Define plans and assign them to organizations</p>
        </div>
        <Button onClick={openNew}>+ New Plan</Button>
      </div>

      <div className="px-7 py-6 max-w-6xl space-y-6">
        {/* Plans grid */}
        {plans.length === 0 ? (
          <EmptyState title="No plans yet" description="Create your first subscription plan." action={<Button onClick={openNew}>+ New Plan</Button>} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => (
              <Card key={p.id} className="p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground font-semibold">{p.name}</h3>
                      {!p.is_active && <Badge tone="neutral" size="sm">inactive</Badge>}
                      {!p.is_public && <Badge tone="warning" size="sm">hidden</Badge>}
                    </div>
                    <p className="text-foreground-4 text-xs mt-0.5">{p.slug}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-foreground font-bold">{p.price_cents ? rupees(p.price_cents) : "Free"}</p>
                    <p className="text-foreground-4 text-xs">/{p.billing_period}</p>
                  </div>
                </div>
                <div className="text-foreground-3 text-sm space-y-1">
                  <p>Interviews: <span className="text-foreground-2">{p.max_interviews_per_month ?? "Unlimited"}</span>/mo</p>
                  <p>Users: <span className="text-foreground-2">{p.max_users ?? "Unlimited"}</span></p>
                </div>
                {p.features?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.features.map((f) => <Badge key={f} tone="brand" size="sm">{f}</Badge>)}
                  </div>
                )}
                <div className="flex gap-2 mt-auto pt-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(p)}>Delete</Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Assignment panel */}
        <Card className="p-5">
          <h2 className="text-foreground font-semibold text-sm mb-4">Assign a plan to an organization</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Field label="Organization">
              <select value={assignOrg} onChange={(e) => setAssignOrg(e.target.value)}
                className="w-full bg-surface-hi border border-base rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50">
                <option value="">Select org…</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Plan">
              <select value={assignPlan} onChange={(e) => setAssignPlan(e.target.value)}
                className="w-full bg-surface-hi border border-base rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50">
                <option value="">Select plan…</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Button onClick={assign} disabled={!assignOrg || !assignPlan}>Assign</Button>
          </div>
          {assignMsg && <p className="text-foreground-3 text-sm mt-3">{assignMsg}</p>}
        </Card>
      </div>

      {/* Create / edit modal */}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New Plan" : "Edit Plan"}>
        <div className="space-y-3">
          {err && <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{err}</div>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Slug"><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="pro" /></Field>
          </div>
          <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹)"><Input type="number" value={form.price_rupees} onChange={(e) => setForm({ ...form, price_rupees: e.target.value })} /></Field>
            <Field label="Billing period">
              <SegmentedControl options={["monthly", "yearly"]} value={form.billing_period} onChange={(v) => setForm({ ...form, billing_period: v })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Interviews / mo" hint="blank = unlimited"><Input type="number" value={form.max_interviews_per_month} onChange={(e) => setForm({ ...form, max_interviews_per_month: e.target.value })} /></Field>
            <Field label="Max users" hint="blank = unlimited"><Input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} /></Field>
          </div>
          <Field label="Features" hint="comma-separated"><Input value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="analytics, branding, sso" /></Field>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-foreground-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
            </label>
            <label className="flex items-center gap-2 text-foreground-2 text-sm">
              <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} /> Public
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={save} loading={saving} disabled={!form.name || !form.slug}>{editing === "new" ? "Create" : "Save"}</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
