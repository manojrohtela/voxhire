import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  title: "VoxHire — AI Voice Interview Platform",
  description: "AI-powered voice interview platform. Post jobs, let AI conduct voice screenings via Vapi, and get detailed candidate reports with scoring — automatically.",
  metadataBase: new URL("https://voxhire.heyagenthive.com"),
  openGraph: {
    type: "website",
    url: "https://voxhire.heyagenthive.com/",
    title: "VoxHire — AI Voice Interview Platform",
    description: "AI-powered voice interview platform. Post jobs, let AI conduct voice screenings via Vapi, and get detailed candidate reports with scoring — automatically.",
    images: [{ url: "https://heyagenthive.com/api/og/voxhire", width: 1200, height: 630 }],
    siteName: "HeyAgentHive",
  },
  twitter: {
    card: "summary_large_image",
    title: "VoxHire — AI Voice Interview Platform",
    description: "AI-powered voice interview platform. Post jobs, let AI conduct voice screenings via Vapi, and get detailed candidate reports with scoring — automatically.",
    images: ["https://heyagenthive.com/api/og/voxhire"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
