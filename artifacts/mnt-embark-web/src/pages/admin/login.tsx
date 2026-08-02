import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAdminAuth } from '@/context/AdminAuthContext';

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const [, navigate] = useLocation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(password);
    setLoading(false);
    if (result.ok) {
      navigate('/admin/tours');
    } else {
      setError(result.error ?? 'Invalid password');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-10">
          <p className="font-serif text-3xl tracking-widest text-foreground">MNT EMBARK</p>
          <p className="font-sans text-xs tracking-[0.25em] text-muted-foreground uppercase mt-1">
            Admin Access
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block font-sans text-xs tracking-widest uppercase text-muted-foreground mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus
              className="w-full bg-card border border-border rounded px-4 py-3 font-sans text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
              placeholder="Enter admin password"
            />
          </div>

          {error && (
            <p className="font-sans text-xs text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-primary text-primary-foreground font-sans text-xs tracking-widest uppercase py-3 rounded transition-opacity disabled:opacity-50 hover:opacity-90"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <a href="/" className="font-sans text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Site
          </a>
        </div>
      </div>
    </div>
  );
}
