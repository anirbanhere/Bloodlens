import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BloodLens",
  description: "Private family health dashboard for tracking lab reports and trends",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen font-sans text-slate-800">
        <div className="lg:flex min-h-screen">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
              {children}
            </main>
            <footer className="border-t border-slate-200 bg-surface">
              <p className="max-w-6xl mx-auto px-4 sm:px-6 py-3 text-xs text-slate-400">
                BloodLens is for personal health record tracking and doctor discussion only.
                It does not provide medical advice, diagnosis, or treatment guidance.
                Always consult a qualified doctor for medical decisions.
              </p>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
