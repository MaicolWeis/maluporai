import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PrivateLayout } from './components/PrivateLayout';
import { useAuth } from './context/AuthContext';
import { EsqueciSenha } from './pages/EsqueciSenha';
import { Login } from './pages/Login';
import { RedefinirSenha } from './pages/RedefinirSenha';
import { Signup } from './pages/Signup';
import { Viagens } from './pages/Viagens';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/redefinir-senha/:token" element={<RedefinirSenha />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <PrivateLayout />
          </PrivateRoute>
        }
      >
        <Route path="viagens" element={<Viagens />} />
        <Route path="*" element={<Navigate to="viagens" replace />} />
      </Route>
    </Routes>
  );
}
