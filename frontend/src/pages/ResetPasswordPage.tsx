import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Home, KeyRound } from 'lucide-react';

import { ApiError, useAuth } from '@/contexts/AuthContext';
import { auth as authApi } from '@/lib/api';

function hasSessionToken(): boolean {
  return typeof window !== 'undefined' && Boolean(localStorage.getItem('access_token'));
}

export default function ResetPasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!hasSessionToken() && !user) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream-50 px-4 py-12">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-sage-100/30 blur-3xl" />
          <div className="absolute right-[-8rem] top-1/3 h-[500px] w-[500px] rounded-full bg-blush-100/20 blur-3xl" />
          <div className="absolute bottom-[-5rem] left-1/4 h-80 w-80 rounded-full bg-dusty-100/15 blur-3xl" />
        </div>

        <div className="w-full max-w-md rounded-3xl border border-sage-100/50 bg-white/80 p-6 text-center shadow-lg shadow-sage-200/15 backdrop-blur-sm sm:p-8">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sage-100 to-sage-200">
            <KeyRound className="h-5 w-5 text-sage-600" />
          </div>
          <h1 className="font-display text-2xl text-charcoal">Password reset link required</h1>
          <p className="mt-3 text-sm text-slate-500">
            Open the reset link from your email again, or request a fresh one if the old link expired.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/forgot-password" className="btn-primary">
              Request new link
            </Link>
            <Link to="/login" className="btn-secondary">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const result = await authApi.updatePassword(password);
      setSuccess(result.message);
      navigate('/', { replace: true });
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

  if (success) {
    return <Navigate to="/" replace />;
  }

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
          <h1 className="font-display text-3xl text-charcoal">Choose a new password</h1>
          <p className="mt-2 text-slate-500">You&apos;re signed in through the recovery link. Set the new password below.</p>
        </div>

        <div className="rounded-3xl border border-sage-100/50 bg-white/80 p-6 shadow-lg shadow-sage-200/15 backdrop-blur-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="alert-error">{error}</div>}

            <div>
              <label htmlFor="password" className="label">
                New password
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

            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Updating password...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
