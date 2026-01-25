import { Navigate } from 'react-router-dom';
import { useSession } from '../lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  // Explicitly request session from server
  const { data: session, isPending } = useSession({
    // Ensure we fetch from server, not just cache
    refetchOnMount: true,
  });

  if (isPending) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
