import axios from 'axios';

// Instância única. Access token vive só em memória (nunca em localStorage).
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // refresh token via cookie httpOnly
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing = false;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // Rotas de /auth/* são públicas: um 401 ali significa "credenciais
    // inválidas" ou "sessão inexistente", não "access token expirado em
    // recurso protegido". Tentar refresh+retry nelas (e redirecionar a
    // força em caso de falha) atropelaria a própria tela de login/signup
    // com um reload completo em vez de deixá-la mostrar o erro inline.
    const isAuthEndpoint = typeof original?.url === 'string' && original.url.startsWith('/auth/');
    if (error.response?.status === 401 && !isAuthEndpoint && !original._retry && !refreshing) {
      original._retry = true;
      refreshing = true;
      try {
        const { data } = await api.post('/auth/refresh');
        setAccessToken(data.accessToken);
        return api(original);
      } catch {
        setAccessToken(null);
        window.location.href = '/login';
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
