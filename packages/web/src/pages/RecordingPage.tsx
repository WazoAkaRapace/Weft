/**
 * RecordingPage
 *
 * Full-page recording interface for creating new journal entries.
 * Wraps the VideoRecorder component and handles navigation.
 */

import { useNavigate } from 'react-router-dom';
import { VideoRecorder } from '../components/VideoRecorder';

export function RecordingPage() {
  const navigate = useNavigate();

  const handleSaveComplete = () => {
    navigate('/dashboard');
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen">
      <VideoRecorder
        onSaveComplete={handleSaveComplete}
        onCancel={handleCancel}
      />
    </div>
  );
}
