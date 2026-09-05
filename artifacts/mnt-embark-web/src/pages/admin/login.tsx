import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAdminAuth } from '@/context/AdminAuthContext';

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(password, email);
    setLoading(false);
    if (result.ok) {
      navigate('/admin/tours');
    } else {
      setError(result.error ?? 'Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <p className="font-serif text-3xl tracking-widest text-foreground">MNT EMBARK</p>
          <p className="font-sans text-xs tracking-[0.25em] text-muted-foreground uppercase mt-1">
            Admin Portal
          </p>
        </div>

        <div className="bg-card border border-border/60 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block font-sans text-xs tracking-widest uppercase text-muted-foreground mb-1.5"
              >
                Email <span className="text-muted-foreground/60 text-[10px] lowercase">(for sub-admins)</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                className="w-full bg-background border border-border rounded px-3.5 py-2.5 font-sans text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
                placeholder="admin@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block font-sans text-xs tracking-widest uppercase text-muted-foreground mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-background border border-border rounded px-3.5 py-2.5 font-sans text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded p-2.5">
                <p className="font-sans text-xs text-destructive text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-primary text-primary-foreground font-sans text-xs tracking-widest uppercase py-3 rounded font-medium transition-opacity disabled:opacity-50 hover:opacity-90 mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <a
            href="/"
            className="font-sans text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Site
          </a>
        </div>
      </div>
    </div>
  );
}
