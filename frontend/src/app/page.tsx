import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

const FEATURES = [
  {
    title: "AI voice interviews, in the browser",
    body: "Candidates click a link and talk to an AI interviewer that asks role-specific questions and adapts its follow-ups to each answer — no scheduling ping-pong, no recruiter on the call.",
    span: true,
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    ),
  },
  {
    title: "Scored report, automatically",
    body: "Every interview produces a structured report: per-skill ratings, communication / confidence / clarity scores, strengths, gaps, and a hire recommendation.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    ),
  },
  {
    title: "Share a report in one click",
    body: "Send a hiring manager a clean, read-only report link — no login, no PDF export. Disable the link any time.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    ),
  },
  {
    title: "Resume-claim verification",
    body: "The AI cross-checks what the candidate said in the interview against their resume and flags each claim as verified, partial, or unsupported.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
  {
    title: "Resume intelligence & bulk upload",
    body: "Drop in a stack of resumes; VoxHire parses each one, de-duplicates candidates, and extracts skills so you can assign them to roles in seconds.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
    ),
  },
];

const STEPS = [
  { n: "1", title: "Post a role, add candidates", body: "Create a job, upload resumes (one or in bulk). VoxHire parses and organizes them." },
  { n: "2", title: "Send the interview link", body: "Candidates take an AI voice interview in their browser, on their own time." },
  { n: "3", title: "Read & share the report", body: "Get a scored report per candidate and share it with your team in one click." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">

      {/* ── Navigation ── */}
      <header className="sticky top-0 z-40 flex justify-between items-center px-6 py-3 w-full bg-white/90 dark:bg-gray-950/90 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400">VoxHire</span>
        </div>

        <div className="flex items-center gap-6">
          <nav className="hidden md:flex gap-6 items-center text-sm text-gray-600 dark:text-gray-400">
            <a href="#how" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">How it works</a>
            <a href="#features" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Features</a>
            <Link href="/auth/login" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Sign in</Link>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="flex flex-col items-center justify-center min-h-[calc(100vh-57px)] px-6 text-center">
          <div className="max-w-3xl mx-auto space-y-8">

            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              AI voice interviews · automatic scored reports
            </span>

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
              Interview every candidate.{" "}
              <span className="text-indigo-600 dark:text-indigo-400">Read the report, not 200 resumes.</span>
            </h1>

            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
              VoxHire runs first-round voice interviews with an AI interviewer, then hands you a
              scored, shareable report on each candidate — so your team spends time only on the
              people worth meeting.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold rounded-lg text-base shadow-lg transition-all duration-200 hover:shadow-indigo-200 dark:hover:shadow-indigo-900 active:scale-[0.98]"
              >
                Explore the live demo
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 px-8 py-3.5 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg text-base transition-colors"
              >
                Organization login
              </Link>
            </div>
            <p className="text-xs text-gray-400">No signup required to try the demo.</p>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" className="max-w-5xl mx-auto px-6 pb-16">
          <h2 className="text-center text-2xl font-bold mb-10">From open role to hire decision in three steps</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center md:text-left">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center mb-3 mx-auto md:mx-0">{s.n}</div>
                <h3 className="font-bold mb-1">{s.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Feature Cards ── */}
        <section id="features" className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`${f.span ? "md:col-span-2" : ""} bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {f.icon}
                  </svg>
                </div>
                <h3 className="text-lg font-bold">{f.title}</h3>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-lg">{f.body}</p>
            </div>
          ))}
        </section>

        {/* ── Closing CTA ── */}
        <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
          <div className="bg-indigo-600 rounded-3xl p-10 text-white">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">See a real interview report in 60 seconds</h2>
            <p className="text-indigo-100 mb-6 max-w-lg mx-auto">
              Jump into a fully-loaded demo workspace — sample jobs, candidates, and AI-scored reports — no signup.
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-indigo-700 font-semibold rounded-lg text-base hover:bg-indigo-50 transition-colors active:scale-[0.98]"
            >
              Explore the live demo
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-12 px-6 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                </svg>
              </div>
              <span className="font-black text-gray-900 dark:text-white">VoxHire</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              AI voice interviews and automatic, shareable candidate reports for modern hiring teams.
            </p>
          </div>

          <div className="space-y-3">
            <h6 className="text-sm font-bold text-gray-900 dark:text-white">Product</h6>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><a href="#how" className="hover:text-indigo-600 transition-colors">How it works</a></li>
              <li><a href="#features" className="hover:text-indigo-600 transition-colors">Features</a></li>
              <li><Link href="/auth/login" className="hover:text-indigo-600 transition-colors">Live demo</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h6 className="text-sm font-bold text-gray-900 dark:text-white">Account</h6>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><Link href="/auth/login" className="hover:text-indigo-600 transition-colors">Organization login</Link></li>
              <li><Link href="/auth/signup" className="hover:text-indigo-600 transition-colors">Sign up</Link></li>
              <li>
                <a href="/admin/login" className="hover:text-gray-600 dark:hover:text-gray-300 text-gray-400 dark:text-gray-600 text-xs transition-colors">
                  Admin
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-10 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} VoxHire. All rights reserved.</p>
          <div className="flex gap-6 text-xs text-gray-400">
            <span>Built for recruiting teams</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
