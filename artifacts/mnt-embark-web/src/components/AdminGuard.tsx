import { Redirect } from 'wouter';
import { useAdminAuth } from '@/context/AdminAuthContext';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAdminAuth();

  // Still checking session
  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-muted-foreground font-sans text-sm tracking-widest uppercase">
          Loading…
        </span>
      </div>
    );
  }

  if (!isAdmin) {
    return <Redirect to="/admin/login" />;
  }

  return <>{children}</>;
}
