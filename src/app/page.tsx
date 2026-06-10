import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-slate-50">
      <main className="text-center px-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">BloodLens</h1>
        <p className="text-slate-500 mb-8 max-w-sm mx-auto">
          Private family health dashboard. Track lab reports, view trends, and prepare doctor summaries.
        </p>
        <Link
          href="/patients"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Open Dashboard
        </Link>
        <p className="mt-12 text-xs text-slate-400 max-w-md mx-auto">
          This app is for personal health record tracking only. It does not provide medical advice, diagnosis, or treatment guidance. Always consult a qualified doctor for medical decisions.
        </p>
      </main>
    </div>
  )
}
