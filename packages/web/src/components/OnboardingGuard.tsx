import { Navigate } from 'react-router-dom';
import { useSession } from '../lib/auth';
import { useState, useEffect } from 'react';
import { getApiUrl } from '../lib/config';

interface CheckUsersResponse {
  hasUsers: boolean;
}

interface OnboardingGuardProps {
  children: React.ReactNode;
}

/**
 * OnboardingGuard checks if the application needs onboarding
 * - If no users exist: redirects to /onboarding
 * - If users exist: renders children (typically login page)
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { data: session, isPending: sessionPending } = useSession();
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Skip onboarding check if user is already authenticated
    if (session) {
      setHasUsers(true);
      setIsLoading(false);
      return;
    }

    const checkUsers = async () => {
      try {
        const response = await fetch(`${getApiUrl()}/api/setup/check-users`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data: CheckUsersResponse = await response.json();
          setHasUsers(data.hasUsers);
        } else {
          // On error, assume users exist (safe default)
          setHasUsers(true);
        }
      } catch (error) {
        console.error('Failed to check users:', error);
        // On error, assume users exist (safe default)
        setHasUsers(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkUsers();
  }, [session]);

  // Show loading while checking session or users
  if (sessionPending || isLoading || hasUsers === null) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // If user is already authenticated, let them through
  if (session) {
    return <>{children}</>;
  }

  // If no users exist, redirect to onboarding
  if (!hasUsers) {
    return <Navigate to="/onboarding" replace />;
  }

  // Users exist and no session - show children (login page)
  return <>{children}</>;
}
