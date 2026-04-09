import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Home, Eye, EyeOff } from 'lucide-react';

import { useAuth, ApiError } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const nextPath = searchParams.get('next');
  const redirectPath = nextPath && nextPath.startsWith('/') ? nextPath : '/';

  if (user) {
    return <Navigate to={redirectPath} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream-50 px-4 py-12">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-sage-100/30 blur-3xl" />
        <div className="absolute left-[-8rem] top-1/3 h-[500px] w-[500px] rounded-full bg-dusty-100/20 blur-3xl" />
        <div className="absolute bottom-[-5rem] right-1/4 h-80 w-80 rounded-full bg-blush-100/15 blur-3xl" />
        <div className="absolute left-1/4 top-10 h-64 w-64 rounded-full bg-lavender-100/20 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-6 inline-flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sage-100 to-sage-200">
              <Home className="h-5 w-5 text-sage-600" />
            </div>
            <span className="font-display text-xl text-charcoal">RoomieManager</span>
          </div>
          <h1 className="font-display text-3xl text-charcoal">Welcome back</h1>
          <p className="mt-2 text-slate-500">Sign in to your RoomieManager account</p>
        </div>

        <div className="rounded-3xl border border-sage-100/50 bg-white/80 p-6 shadow-lg shadow-sage-200/15 backdrop-blur-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="alert-error">{error}</div>}

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@university.edu"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-sage-600 transition-colors hover:text-sage-700">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
