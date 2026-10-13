import { useState } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Calculator, 
  History, 
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../../lib/hooks';
import { isDemoMode } from '../../lib/api';
import { Button, Avatar, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui';
import { cn } from '../../lib/utils';

const navigation = [
  { name: 'Inicio', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Grupos', href: '/groups', icon: Users },
  { name: 'Gastos', href: '/expenses', icon: CreditCard },
  { name: 'Balances', href: '/balances', icon: Calculator },
  { name: 'Liquidaciones', href: '/settlements', icon: History },
  { name: 'Configuración', href: '/settings', icon: Settings },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar"
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-surface-50 border-r border-border-primary transform transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        role="navigation"
        aria-label="Navegación principal"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-border-primary">
            <Link to="/dashboard" className="inline-flex items-center gap-2" aria-label="Pazito - Inicio">
              <svg className="w-8 h-8 text-brand-600" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="32" height="32" rx="8" fill="currentColor" />
                <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-lg font-bold text-text-primary">Pazito</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Menú principal">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-text-secondary hover:bg-surface-200 hover:text-text-primary'
                  )
                }
                onClick={() => setSidebarOpen(false)}
                aria-current={location.pathname === item.href ? 'page' : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-border-primary">
            <div className="flex items-center gap-3">
              <Avatar name={user?.name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{user?.name}</p>
                <p className="text-xs text-text-tertiary truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-surface-50/80 backdrop-blur-sm border-b border-border-primary">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 rounded-lg text-text-secondary hover:bg-surface-200"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
              aria-expanded={sidebarOpen}
              aria-controls="sidebar"
            >
              <Menu className="w-6 h-6" aria-hidden="true" />
            </button>

            {/* Page title */}
            <div className="flex-1 lg:flex-none">
              <h1 className="text-lg font-semibold text-text-primary truncate" id="page-title">
                {getPageTitle(location.pathname)}
              </h1>
            </div>

            {/* User menu */}
            <div className="relative">
              <button
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-200"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                aria-label="Menú de usuario"
              >
                <Avatar name={user?.name} size="sm" />
                <span className="hidden sm:block text-sm font-medium text-text-primary">{user?.name}</span>
                <ChevronDown className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 mt-2 w-48 card shadow-lg border border-border-primary py-1 z-50 animate-in slide-in-from-bottom">
                    <DropdownMenuItem
                      onClick={() => { setUserMenuOpen(false); /* navigate to profile */ }}
                    >
                      <UserIcon className="w-4 h-4" aria-hidden="true" />
                      Perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => { setUserMenuOpen(false); /* navigate to settings */ }}
                    >
                      <Settings className="w-4 h-4" aria-hidden="true" />
                      Configuración
                    </DropdownMenuItem>
                    <hr className="my-1 border-border-primary" />
                    <DropdownMenuItem onClick={handleLogout} className="text-error-600">
                      <LogOut className="w-4 h-4" aria-hidden="true" />
                      Cerrar sesión
                    </DropdownMenuItem>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {isDemoMode() && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900" role="status">
            Modo demostración: datos ficticios y temporales. No se guardan en el backend.
          </div>
        )}
        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8" id="main-content" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    '/dashboard': 'Inicio',
    '/groups': 'Grupos',
    '/expenses': 'Gastos',
    '/balances': 'Balances',
    '/settlements': 'Liquidaciones',
    '/settings': 'Configuración',
  };

  // Handle dynamic routes
  if (pathname.startsWith('/groups/')) {
    if (pathname.match(/\/groups\/[^/]+\/expenses/)) return 'Gasto';
    if (pathname.match(/\/groups\/[^/]+\/balances/)) return 'Balance';
    if (pathname.match(/\/groups\/[^/]+\/settlements/)) return 'Liquidaciones';
    if (pathname.includes('/edit') || pathname.includes('/new')) return 'Grupo';
    return 'Grupo';
  }

  return titles[pathname] || 'Pazito';
}