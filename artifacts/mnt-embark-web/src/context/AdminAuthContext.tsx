import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

interface AdminAuthState {
  isAdmin: boolean | null; // null = still loading
  login: (password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/me`, { credentials: 'include' })
      .then(r => setIsAdmin(r.ok))
      .catch(() => setIsAdmin(false));
  }, []);

  const login = useCallback(async (password: string) => {
    const r = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (r.ok) {
      setIsAdmin(true);
      return { ok: true };
    }
    const data = await r.json().catch(() => ({}));
    return { ok: false, error: data.error ?? 'Invalid password' };
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/api/admin/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    setIsAdmin(false);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
