import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../lib/hooks';
import { ToastProvider, Button } from '../components/ui';
import AuthForm from './features/auth/AuthForm';
import DashboardLayout from './layouts/DashboardLayout';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Cargando">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" aria-hidden="true" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function DemoEntry() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, startDemoSession } = useAuth();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, isLoading, navigate]);

  const enterDemo = async () => {
    setIsStarting(true);
    setError(null);
    try {
      await startDemoSession();
      navigate('/dashboard', { replace: true });
    } catch {
      setError('No se pudo abrir la demostración. Recarga la página e inténtalo de nuevo.');
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading || isAuthenticated) return <LoadingScreen />;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-lg card p-6 sm:p-8" aria-labelledby="demo-title">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 text-2xl font-bold" aria-hidden="true">P</div>
          <h1 id="demo-title" className="text-2xl font-bold text-text-primary">Prueba Pazito sin registrarte</h1>
          <p className="mt-3 text-text-secondary">Entrarás con un usuario y datos ficticios. No se crea una cuenta real ni se guardan los cambios de demostración en tu base de Clever Cloud.</p>
        </div>
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          La demostración es temporal: los cambios se guardan solo en la memoria de esta pestaña y se pierden al recargar. Algunas pantallas del producto siguen siendo prototipos.
        </div>
        {error && <p className="mt-4 rounded-lg bg-error-50 p-3 text-sm text-error-700" role="alert">{error}</p>}
        <Button type="button" fullWidth loading={isStarting} onClick={enterDemo} className="mt-6">Entrar a la demo</Button>
        <p className="mt-5 text-center text-sm text-text-secondary">¿Quieres guardar tus propios datos? <Link to="/auth/register" className="font-medium text-brand-600 hover:underline">Crear cuenta</Link></p>
        <p className="mt-3 text-center text-sm"><Link to="/auth/login" className="text-text-secondary hover:underline">Ya tengo una cuenta</Link></p>
      </section>
    </div>
  );
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="max-w-3xl">
      <h2 className="text-2xl font-semibold text-text-primary mb-3">{title}</h2>
      <p className="text-text-secondary">{description}</p>
      <div className="mt-6 rounded-xl border border-border-primary bg-surface-50 p-5">
        <p className="text-sm text-text-secondary mb-0">
          Esta sección todavía está en desarrollo. No se muestran datos ficticios como si fueran datos reales.
        </p>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/demo" element={<DemoEntry />} />

            <Route path="/auth/login" element={<PublicRoute><AuthForm mode="login" /></PublicRoute>} />
            <Route path="/auth/register" element={<PublicRoute><AuthForm mode="register" /></PublicRoute>} />
            <Route path="/auth/forgot" element={<PublicRoute><AuthForm mode="forgot" /></PublicRoute>} />
            <Route path="/auth/reset" element={<PublicRoute><AuthForm mode="reset" /></PublicRoute>} />

            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<PlaceholderPage title="Resumen" description="Aquí aparecerán tus grupos, gastos recientes y balance personal." />} />
              <Route path="/groups" element={<PlaceholderPage title="Tus grupos" description="Próximo paso: crear grupos, invitar miembros y gestionar roles." />} />
              <Route path="/groups/new" element={<PlaceholderPage title="Crear grupo" description="El formulario para crear grupos aún está pendiente." />} />
              <Route path="/groups/:groupId" element={<PlaceholderPage title="Detalle del grupo" description="Aquí se mostrarán los miembros, gastos y balance del grupo." />} />
              <Route path="/groups/:groupId/edit" element={<PlaceholderPage title="Editar grupo" description="La edición de grupos aún está pendiente." />} />
              <Route path="/groups/:groupId/expenses/new" element={<PlaceholderPage title="Registrar gasto" description="El formulario de gastos con reparto equitativo, montos y porcentajes aún está pendiente." />} />
              <Route path="/groups/:groupId/expenses/:expenseId/edit" element={<PlaceholderPage title="Editar gasto" description="La edición de gastos aún está pendiente." />} />
              <Route path="/expenses" element={<PlaceholderPage title="Gastos" description="Aquí podrás consultar y filtrar gastos de todos tus grupos." />} />
              <Route path="/balances" element={<PlaceholderPage title="Balances" description="Aquí se calculará quién debe a quién, por moneda y grupo." />} />
              <Route path="/settlements" element={<PlaceholderPage title="Liquidaciones" description="Aquí podrás declarar, confirmar y disputar pagos manuales." />} />
              <Route path="/settings" element={<PlaceholderPage title="Configuración" description="Aquí estarán el perfil, preferencias de idioma, moneda y privacidad." />} />
              <Route path="/groups/:groupId/balances" element={<PlaceholderPage title="Balance del grupo" description="El balance detallado del grupo aún está pendiente." />} />
              <Route path="/groups/:groupId/settlements" element={<PlaceholderPage title="Liquidaciones del grupo" description="Las liquidaciones por grupo aún están pendientes." />} />
            </Route>

            <Route path="*" element={<PlaceholderPage title="Página no encontrada" description="La dirección no existe dentro de Pazito." />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  );
}
