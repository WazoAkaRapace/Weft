import { useSession, signOut } from '../lib/auth';

export function DashboardPage() {
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
          <span className="user-name">{session?.user?.name || 'User'}</span>
          <button onClick={handleSignOut} className="sign-out-button">
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-card">
          <h2>Welcome to Weft</h2>
          <p>Your video journaling application</p>
        </div>
      </main>
    </div>
  );
}
