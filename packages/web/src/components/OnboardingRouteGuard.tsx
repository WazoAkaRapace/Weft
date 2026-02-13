import { Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getApiUrl } from '../lib/config';

interface CheckUsersResponse {
  hasUsers: boolean;
}

interface OnboardingRouteGuardProps {
  children: React.ReactNode;
}

/**
 * OnboardingRouteGuard protects the onboarding page
 * - If users already exist: redirects to /login (onboarding already done)
 * - If no users exist: renders children (onboarding page)
 */
export function OnboardingRouteGuard({ children }: OnboardingRouteGuardProps) {
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
          // On error, assume users exist (safe default - redirect to login)
          setHasUsers(true);
        }
      } catch (error) {
        console.error('Failed to check users:', error);
        // On error, assume users exist (safe default - redirect to login)
        setHasUsers(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkUsers();
  }, []);

  if (isLoading || hasUsers === null) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // If users already exist, redirect to login (onboarding not needed)
  if (hasUsers) {
    return <Navigate to="/login" replace />;
  }

  // No users exist - show onboarding page
  return <>{children}</>;
}
