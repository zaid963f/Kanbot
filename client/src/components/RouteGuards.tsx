import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Loading } from './States';

// Pages for logged-in users only.
export function PrivateRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <Outlet />;
}

// Login and register: logged-in users are sent into the app.
export function GuestRoute() {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();

  if (loading) return <Loading />;
  if (user) {
    const redirect = searchParams.get('redirect');
    // only allow our own pages ("/..."), never another website
    const target = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/projects';
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}
