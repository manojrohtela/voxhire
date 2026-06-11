import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

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
            <a href="#features" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Features</a>
            <a href="#" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Support</a>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="flex flex-col items-center justify-center min-h-[calc(100vh-57px)] px-6 text-center">
          <div className="max-w-3xl mx-auto space-y-8">

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
              Automate candidate screening and conduct AI-powered interviews with{" "}
              <span className="text-indigo-600 dark:text-indigo-400">enterprise-grade precision.</span>
            </h1>

            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
              Leverage advanced language models to filter thousands of applicants in seconds,
              ensuring your hiring team focuses only on top-tier talent.
            </p>

            {/* Organization Login Button */}
            <div className="flex items-center justify-center pt-2">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold rounded-lg text-base shadow-lg transition-all duration-200 hover:shadow-indigo-200 dark:hover:shadow-indigo-900 active:scale-[0.98]"
              >
                Organization Login
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="pt-10">
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-5">
                Trusted by high-growth engineering teams
              </p>
              <div className="flex flex-wrap justify-center items-center gap-10 opacity-50">
                {["⚡ STREAM", "☁ NEBULA", "⚙ KUBE", "🛡 VAULT"].map((label) => (
                  <span key={label} className="text-sm font-black text-gray-600 dark:text-gray-400 tracking-wider">{label}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature Cards ── */}
        <section id="features" className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="md:col-span-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold">Real-time Skill Assessment</h3>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-lg">
              Our AI analyzes candidate responses and communication styles in real-time, providing deep insights beyond a standard resume.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="text-lg font-bold">Autonomous Interviews</h4>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Conduct initial rounds at scale with AI agents that ask insightful follow-up questions based on each candidate's unique profile.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
              </svg>
              <h5 className="text-base font-bold">Bias Mitigation</h5>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Sophisticated anonymization protocols to ensure fair and equitable hiring practices across all candidate evaluations.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h5 className="text-base font-bold">ATS Integration</h5>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Seamlessly syncs with your existing ATS to keep hiring workflows moving fast.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h5 className="text-base font-bold">SOC2 Compliant</h5>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Enterprise-grade security and data privacy standards to protect sensitive candidate and company data.
            </p>
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
              Redefining human resources through the power of ethical and precise artificial intelligence.
            </p>
          </div>

          <div className="space-y-3">
            <h6 className="text-sm font-bold text-gray-900 dark:text-white">Product</h6>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><a href="#features" className="hover:text-indigo-600 transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Solutions</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h6 className="text-sm font-bold text-gray-900 dark:text-white">Support</h6>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Contact Us</a></li>
              <li>
                <a href="/admin/login" className="hover:text-gray-600 dark:hover:text-gray-300 text-gray-400 dark:text-gray-600 text-xs transition-colors">
                  Admin
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-10 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-gray-400">© 2024 VoxHire Technologies Inc. All rights reserved.</p>
          <div className="flex gap-6 text-xs text-gray-400">
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
