"use client";

import { useCallback, useEffect, useState } from "react";
import { apiWithAuth, useAuth } from "@/lib/auth";
import { Button, Card, Badge, LoadingScreen } from "@/components/ui";

interface Plan {
  id: string; name: string; description?: string | null;
  price_cents: number; currency: string; billing_period: string;
  max_interviews_per_month: number | null; max_users: number | null;
  features: string[];
}
interface Sub {
  has_subscription: boolean;
  plan: { id: string; name: string } | null;
  usage: { interviews_used: number; interviews_limit: number | null };
}

function rupees(cents: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(cents / 100);
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && (window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function BillingPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      apiWithAuth("/api/v1/billing/plans").then((r) => r.json()),
      apiWithAuth("/api/v1/billing/subscription").then((r) => r.json()),
    ]);
    setPlans(Array.isArray(p) ? p : []);
    setSub(s);
  }, []);

  useEffect(() => { load(); }, [load]);

  const subscribe = async (plan: Plan) => {
    setBusy(plan.id); setMsg(null);
    try {
      const res = await apiWithAuth("/api/v1/billing/checkout", { method: "POST", body: JSON.stringify({ plan_id: plan.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Checkout failed");

      if (data.free) {
        setMsg({ kind: "ok", text: `You're on ${plan.name}.` });
        await load();
        return;
      }

      const ok = await loadRazorpay();
      if (!ok) throw new Error("Couldn't load the payment window. Check your connection.");

      const rzp = new (window as any).Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "VoxHire",
        description: `${data.plan_name} plan`,
        order_id: data.order_id,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#6c63ff" },
        handler: async (resp: any) => {
          const v = await apiWithAuth("/api/v1/billing/verify", {
            method: "POST",
            body: JSON.stringify({
              plan_id: plan.id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          if (v.ok) { setMsg({ kind: "ok", text: `Payment successful — you're now on ${plan.name}! 🎉` }); await load(); }
          else { const e = await v.json().catch(() => ({})); setMsg({ kind: "err", text: e.detail || "Verification failed" }); }
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      rzp.open();
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(null);
    }
  };

  if (plans === null) return <LoadingScreen label="Loading plans…" />;

  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-20 px-7 py-4 border-b border-faint bg-background/90 backdrop-blur">
        <h1 className="text-foreground font-semibold text-lg tracking-tight">Billing & Plans</h1>
        <p className="text-foreground-4 text-xs mt-0.5">
          {sub?.has_subscription && sub.plan
            ? `Current plan: ${sub.plan.name} · ${sub.usage.interviews_used}${sub.usage.interviews_limit != null ? ` / ${sub.usage.interviews_limit}` : ""} interviews this month`
            : "Choose a plan to get started"}
        </p>
      </div>

      <div className="px-7 py-6 max-w-5xl">
        {msg && (
          <div className={`mb-5 px-4 py-3 rounded-xl text-sm border ${
            msg.kind === "ok" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>{msg.text}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((p) => {
            const current = sub?.plan?.id === p.id;
            return (
              <Card key={p.id} className={`p-6 flex flex-col gap-4 ${current ? "border-primary/40 ring-1 ring-primary/20" : ""}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-foreground font-semibold text-lg">{p.name}</h3>
                    {current && <Badge tone="brand" size="sm">Current</Badge>}
                  </div>
                  {p.description && <p className="text-foreground-3 text-sm mt-1 leading-relaxed">{p.description}</p>}
                </div>
                <div>
                  <span className="text-3xl font-bold text-foreground">{p.price_cents ? rupees(p.price_cents) : "Free"}</span>
                  {p.price_cents > 0 && <span className="text-foreground-4 text-sm"> /{p.billing_period}</span>}
                </div>
                <ul className="space-y-2 text-sm text-foreground-2 flex-1">
                  <li>✓ {p.max_interviews_per_month ?? "Unlimited"} interviews / month</li>
                  <li>✓ {p.max_users ?? "Unlimited"} team members</li>
                  {p.features?.map((f) => <li key={f}>✓ {f.replace(/_/g, " ")}</li>)}
                </ul>
                <Button block disabled={current || busy === p.id} loading={busy === p.id} onClick={() => subscribe(p)}>
                  {current ? "Current plan" : p.price_cents ? "Subscribe" : "Choose Free"}
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="text-foreground-4 text-xs mt-6">
          Payments are processed securely by Razorpay. Test mode: use card 4111 1111 1111 1111, any future expiry & CVV.
        </p>
      </div>
    </div>
  );
}
