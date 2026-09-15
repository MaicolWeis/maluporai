import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PrivateLayout } from './components/PrivateLayout';
import { useAuth } from './context/AuthContext';
import { AtivarConta } from './pages/AtivarConta';
import { EsqueciSenha } from './pages/EsqueciSenha';
import { Login } from './pages/Login';
import { RedefinirSenha } from './pages/RedefinirSenha';
import { Signup } from './pages/Signup';
import { Usuarios } from './pages/Usuarios';
import { Viagens } from './pages/Viagens';

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
        <Route path="viagens" element={<Viagens />} />
        <Route
          path="configuracoes/usuarios"
          element={
            <AdminRoute>
              <Usuarios />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="viagens" replace />} />
      </Route>
    </Routes>
  );
}
