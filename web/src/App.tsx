import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ConfiguracoesLayout } from './components/ConfiguracoesLayout';
import { PrivateLayout } from './components/PrivateLayout';
import { useAuth } from './context/AuthContext';
import { AtivarConta } from './pages/AtivarConta';
import { Clientes } from './pages/Clientes';
import { Empresa } from './pages/configuracoes/Empresa';
import { Preferencias } from './pages/configuracoes/Preferencias';
import { Auditoria } from './pages/configuracoes/Auditoria';
import { Privacidade } from './pages/configuracoes/Privacidade';
import { PoliticaPrivacidade } from './pages/PoliticaPrivacidade';
import { EsqueciSenha } from './pages/EsqueciSenha';
import { Login } from './pages/Login';
import { RedefinirSenha } from './pages/RedefinirSenha';
import { Signup } from './pages/Signup';
import { Usuarios } from './pages/Usuarios';
import { Viagens } from './pages/Viagens';

// recharts pesa ~400 kB: o dashboard é carregado sob demanda.
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

// Esconder o item no menu (PrivateLayout) já resolve a UX normal; isso aqui
// é só pra não deixar a rota "funcionando" caso alguém digite a URL direto
// — a API já rejeita com 403 de qualquer forma (defesa em profundidade).
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.papel !== 'admin') return <Navigate to="/viagens" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/privacidade" element={<PoliticaPrivacidade />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/redefinir-senha/:token" element={<RedefinirSenha />} />
      <Route path="/ativar-conta/:token" element={<AtivarConta />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <PrivateLayout />
          </PrivateRoute>
        }
      >
        <Route
          path="dashboard"
          element={
            <Suspense fallback={<p className="text-sm text-zinc-500">Carregando…</p>}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route path="viagens" element={<Viagens />} />
        <Route path="clientes" element={<Clientes />} />
        <Route
          path="configuracoes"
          element={
            <AdminRoute>
              <ConfiguracoesLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to="empresa" replace />} />
          <Route path="empresa" element={<Empresa />} />
          <Route path="preferencias" element={<Preferencias />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="privacidade" element={<Privacidade />} />
          <Route path="auditoria" element={<Auditoria />} />
        </Route>
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}
