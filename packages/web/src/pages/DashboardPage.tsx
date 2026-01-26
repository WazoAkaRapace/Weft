import { useNavigate } from 'react-router-dom';
import { useSession, signOut } from '../lib/auth';
import { useNavigate } from 'react-router-dom';

export function DashboardPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();

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
        <div className="header-left">
          <h1>Weft Dashboard</h1>
        </div>
        <div className="header-center">
          <div className="header-buttons">
            <button onClick={() => navigate('/recording')} className="recording-button">
              + New Recording
            </button>
            <button onClick={() => navigate('/history')} className="history-button">
              View History
            </button>
          </div>
        </div>
        <div className="user-info">
          <button
            onClick={() => navigate('/record')}
            className="new-entry-button"
          >
            + New Entry
          </button>
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
