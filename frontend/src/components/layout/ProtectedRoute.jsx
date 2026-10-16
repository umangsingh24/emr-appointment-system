import { ShieldAlert } from 'lucide-react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../ui/Button.jsx';
import { PageLoader } from '../ui/Spinner.jsx';
import { EmptyState } from '../ui/States.jsx';

/**
 * Guards a group of routes. Without `roles` it only requires a session.
 * UI guards are for UX; the API enforces the same rules independently.
 */
export function ProtectedRoute({ roles }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader label="Restoring your session…" />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;

  if (roles && !roles.includes(user.role)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to this page"
        description="Ask a Super Admin if you think you should."
        action={
          <Link to="/">
            <Button variant="secondary">Back to dashboard</Button>
          </Link>
        }
      />
    );
  }

  return <Outlet />;
}
