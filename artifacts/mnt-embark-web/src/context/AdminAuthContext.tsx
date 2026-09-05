import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export interface AdminUser {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  email?: string;
  id?: number;
}

interface AdminAuthState {
  isAdmin: boolean | null; // null = still loading
  isSuperAdmin: boolean;
  adminEmail: string | null;
  adminId: number | null;
  login: (password: string, email?: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [adminId, setAdminId] = useState<number | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/me`, { credentials: 'include' });
      if (r.ok) {
        const data = (await r.json()) as AdminUser;
        setIsAdmin(true);
        setIsSuperAdmin(data.isSuperAdmin === true);
        setAdminEmail(data.email ?? null);
        setAdminId(data.id ?? null);
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAdminEmail(null);
        setAdminId(null);
      }
    } catch {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setAdminEmail(null);
      setAdminId(null);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (password: string, email?: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, email: email?.trim() || undefined }),
      });
      if (r.ok) {
        const data = await r.json();
        setIsAdmin(true);
        setIsSuperAdmin(data.isSuperAdmin === true);
        setAdminEmail(data.email ?? null);
        return { ok: true };
      }
      const data = await r.json().catch(() => ({}));
      return { ok: false, error: data.error ?? 'Invalid email or password' };
    } catch {
      return { ok: false, error: 'Connection error while logging in' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/admin/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setAdminEmail(null);
      setAdminId(null);
    }
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        isAdmin,
        isSuperAdmin,
        adminEmail,
        adminId,
        login,
        logout,
        refreshAuth: checkAuth,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
