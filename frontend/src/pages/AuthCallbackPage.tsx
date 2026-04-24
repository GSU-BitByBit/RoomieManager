import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Home, LoaderCircle } from 'lucide-react';

import { ApiError, useAuth } from '@/contexts/AuthContext';
import { auth as authApi } from '@/lib/api';
import {
  describeEmailAction,
  parseAuthCallbackUrl,
  resolvePostEmailActionPath,
} from '@/lib/auth-callback';

export default function AuthCallbackPage() {
  const { acceptSession } = useAuth();
  const navigate = useNavigate();
  const ranRef = useRef(false);
  const [status, setStatus] = useState('Finalizing your sign-in...');
  const [error, setError] = useState('');

  useEffect(() => {
    if (ranRef.current) {
      return;
    }
    ranRef.current = true;

    const finalizeAuth = async () => {
      const parsed = parseAuthCallbackUrl(new URL(window.location.href));

      if (parsed.errorMessage) {
        setError(parsed.errorMessage);
        return;
      }

      setStatus(describeEmailAction(parsed.type));

      try {
        if (parsed.session) {
          await acceptSession(parsed.session);
          navigate(resolvePostEmailActionPath(parsed.type), { replace: true });
          return;
        }

        if (parsed.tokenHash && parsed.type) {
          const result = await authApi.exchangeEmailAction(parsed.tokenHash, parsed.type);

          if (!result.session) {
            throw new Error('No session was returned for this email action.');
          }

          await acceptSession(result.session, result.user ?? undefined);
          navigate(resolvePostEmailActionPath(parsed.type), { replace: true });
          return;
        }

        setError('This email link is missing the session details needed to continue. Request a new link and try again.');
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('We could not complete that email action. Request a new link and try again.');
        }
      }
    };

    void finalizeAuth();
  }, [acceptSession, navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream-50 px-4 py-12">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-sage-100/30 blur-3xl" />
        <div className="absolute left-[-8rem] top-1/3 h-[500px] w-[500px] rounded-full bg-dusty-100/20 blur-3xl" />
        <div className="absolute bottom-[-5rem] right-1/4 h-80 w-80 rounded-full bg-blush-100/15 blur-3xl" />
      </div>

      <div className="w-full max-w-md rounded-3xl border border-sage-100/50 bg-white/80 p-6 text-center shadow-lg shadow-sage-200/15 backdrop-blur-sm sm:p-8">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sage-100 to-sage-200">
          {error ? (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          ) : (
            <LoaderCircle className="h-5 w-5 animate-spin text-sage-600" />
          )}
        </div>

        <div className="mb-4 inline-flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sage-100 to-sage-200">
            <Home className="h-4 w-4 text-sage-600" />
          </div>
          <span className="font-display text-lg text-charcoal">RoomieManager</span>
        </div>

        <h1 className="font-display text-2xl text-charcoal">
          {error ? 'Email action could not be completed' : 'One moment'}
        </h1>

        <p className="mt-3 text-sm text-slate-500">
          {error || status}
        </p>

        {error && (
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/login" className="btn-primary">
              Back to login
            </Link>
            <Link to="/forgot-password" className="btn-secondary">
              New reset link
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
