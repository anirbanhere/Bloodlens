import Link from 'next/link'

export default function NavBar() {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/patients" className="flex items-center gap-2 font-semibold text-slate-800">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" aria-hidden />
          BloodLens
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <Link href="/patients" className="hover:text-slate-900">Patients</Link>
        </nav>
      </div>
    </header>
  )
}
