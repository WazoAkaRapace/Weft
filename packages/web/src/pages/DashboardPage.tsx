import { useUser, useSession, signOut } from '../lib/auth';

export function DashboardPage() {
  const { data: user } = useUser();
  const { data: session } = useSession();

  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/login';
        },
      },
    });
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Weft Dashboard</h1>
        <div className="user-info">
          {user?.image && <img src={user.image} alt={user.name || 'User'} className="user-avatar" />}
          <span className="user-name">{user?.name || 'User'}</span>
          <button onClick={handleSignOut} className="sign-out-button">
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-card">
          <h2>Welcome to Weft</h2>
          <p>Your video journaling application</p>

          {user && (
            <div className="user-details">
              <h3>Your Profile</h3>
              <dl>
                <dt>Name:</dt>
                <dd>{user.name || 'Not set'}</dd>
                <dt>Email:</dt>
                <dd>{user.email}</dd>
                <dt>Email Verified:</dt>
                <dd>{user.emailVerified ? 'Yes' : 'No'}</dd>
              </dl>
            </div>
          )}

          <div className="dashboard-actions">
            <button className="primary-button">New Journal Entry</button>
            <button className="secondary-button">View History</button>
          </div>
        </div>
      </main>
    </div>
  );
}
