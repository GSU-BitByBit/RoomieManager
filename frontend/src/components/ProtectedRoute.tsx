import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

function buildProtectedLoginPath(location: ReturnType<typeof useLocation>) {
  const nextPath = `${location.pathname}${location.search}`;
  const params = new URLSearchParams();

  if (nextPath.startsWith('/')) {
    params.set('next', nextPath);
  }

  return `/login${params.toString() ? `?${params.toString()}` : ''}`;
}

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream-50">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-sage-200 border-t-sage-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={buildProtectedLoginPath(location)} replace />;
  }

  return <Outlet />;
}
