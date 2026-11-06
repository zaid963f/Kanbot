import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth';
import { getToken, removeToken, saveToken, setUnauthorizedHandler } from '../api/client';
import type { User } from '../types/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  // If we have a saved token we must check it first, so we start in "loading".
  const [loading, setLoading] = useState(getToken() !== null);

  useEffect(() => {
    // Any 401 from the server = the session is over. Go to login and remember the page.
    setUnauthorizedHandler(() => {
      removeToken();
      queryClient.clear();
      const currentPage = window.location.pathname;
      window.location.href = `/login?redirect=${encodeURIComponent(currentPage)}&expired=1`;
    });

    // Stay logged in after a page reload.
    if (getToken()) {
      authApi
        .getMe()
        .then((data) => setUser(data.user))
        .catch(() => removeToken())
        .finally(() => setLoading(false));
    }
  }, [queryClient]);

  async function login(email: string, password: string) {
    const data = await authApi.login({ email, password });
    saveToken(data.token);
    setUser(data.user);
  }

  async function register(name: string, email: string, password: string) {
    const data = await authApi.register({ name, email, password });
    saveToken(data.token);
    setUser(data.user);
  }

  function logout() {
    removeToken();
    queryClient.clear();
    // A full page load clears everything and lands on the login page.
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
