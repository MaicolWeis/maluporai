import { createContext, useContext, useEffect, useState } from 'react';
import { api, setAccessToken } from '../lib/api';

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  papel: 'admin' | 'operador';
  tenant: { id: string; nomeFantasia: string };
}

interface AuthContextValue {
  user: AuthUser | null;
  /** true enquanto tenta restaurar a sessão via refresh no boot do app. */
  loading: boolean;
  setSession: (user: AuthUser, accessToken: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  setSession: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // O access token só vive em memória: a cada carregamento da página ele
  // se perde. O cookie httpOnly de refresh (7 dias) é quem sustenta a
  // sessão entre recarregamentos — por isso tentamos um refresh silencioso
  // assim que o app sobe, antes de decidir se mostra tela de login.
  useEffect(() => {
    let ativo = true;
    api
      .post('/auth/refresh')
      .then(({ data }) => {
        if (!ativo) return;
        setAccessToken(data.accessToken);
        setUser(data.user);
      })
      .catch(() => {
        if (ativo) setUser(null);
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const setSession = (nextUser: AuthUser, accessToken: string) => {
    setAccessToken(accessToken);
    setUser(nextUser);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, setSession, logout }}>{children}</AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
