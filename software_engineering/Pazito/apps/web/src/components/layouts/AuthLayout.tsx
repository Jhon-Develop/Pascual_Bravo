import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-surface-50">
      <header className="container py-4">
        <a href="/" className="inline-flex items-center gap-2" aria-label="Pazito - Inicio">
          <svg className="w-8 h-8 text-brand-600" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="currentColor" />
            <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-lg font-bold text-text-primary">Pazito</span>
        </a>
      </header>
      <main className="flex-1 flex items-center justify-center py-8 px-4">
        <Outlet />
      </main>
      <footer className="container py-6 text-center text-sm text-text-tertiary">
        <p>© 2024 Pazito. Cuentas claras, amistades tranquilas.</p>
      </footer>
    </div>
  );
}