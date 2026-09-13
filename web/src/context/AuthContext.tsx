import { createContext, useContext, useState } from 'react';

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  papel: 'admin' | 'operador';
  tenant: { id: string; nomeFantasia: string };
}

interface AuthContextValue {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue>({ user: null, setUser: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
