import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Home, Sparkles, Eye, EyeOff } from 'lucide-react';

import { useAuth, ApiError } from '@/contexts/AuthContext';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await register(email, password, fullName || undefined);

      if (!localStorage.getItem('access_token')) {
        setSuccess('Account created! Check your email to confirm, then sign in.');
      } else {
        navigate('/');
      }
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
        <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-sage-100/30 blur-3xl" />
        <div className="absolute right-[-8rem] top-1/3 h-[500px] w-[500px] rounded-full bg-blush-100/20 blur-3xl" />
        <div className="absolute bottom-[-5rem] left-1/4 h-80 w-80 rounded-full bg-dusty-100/15 blur-3xl" />
        <div className="absolute right-1/4 top-10 h-64 w-64 rounded-full bg-lavender-100/20 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-6 inline-flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sage-100 to-sage-200">
              <Home className="h-5 w-5 text-sage-600" />
            </div>
            <span className="font-display text-xl text-charcoal">RoomieManager</span>
          </div>
          <h1 className="font-display text-3xl text-charcoal">Create your account</h1>
          <p className="mt-2 text-slate-500">Join RoomieManager to manage your group</p>
        </div>

        <div className="rounded-3xl border border-sage-100/50 bg-white/80 p-6 shadow-lg shadow-sage-200/15 backdrop-blur-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="alert-error">{error}</div>}
            {success && (
              <div className="alert-success flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sage-500" />
                <span>{success}</span>
              </div>
            )}

            <div>
              <label htmlFor="fullName" className="label">
                Full Name <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="fullName"
                type="text"
                className="input"
                placeholder="Alex Smith"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                maxLength={120}
                autoComplete="name"
              />
            </div>

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
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
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
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-sage-600 transition-colors hover:text-sage-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
