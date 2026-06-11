import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

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
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
        <NavBar />
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <p className="max-w-5xl mx-auto px-4 py-3 text-xs text-slate-400">
            BloodLens is for personal health record tracking and doctor discussion only.
            It does not provide medical advice, diagnosis, or treatment guidance.
            Always consult a qualified doctor for medical decisions.
          </p>
        </footer>
      </body>
    </html>
  );
}
