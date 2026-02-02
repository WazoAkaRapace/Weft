import { useNavigate } from 'react-router-dom';
import { FeedCard } from './FeedCard';
import type { FeedEntry } from '@weft/shared';

interface EmptyFeedStateProps {
  hasNotes: boolean;
  hasJournals: boolean;
}

// Sample entries to demonstrate the feature
const sampleJournals: FeedEntry[] = [
  {
    id: 'sample-journal-1',
    type: 'journal',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    title: 'Morning Reflection',
    thumbnailPath: null,
    duration: 180,
    dominantEmotion: 'happy',
  },
  {
    id: 'sample-journal-2',
    type: 'journal',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    title: 'Project Planning Session',
    thumbnailPath: null,
    duration: 300,
    dominantEmotion: 'focused',
  },
];

const sampleNotes: FeedEntry[] = [
  {
    id: 'sample-note-1',
    type: 'note',
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    title: 'Ideas for the weekend',
    icon: '💡',
  },
  {
    id: 'sample-note-2',
    type: 'note',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    title: 'Book recommendations',
    icon: '📚',
  },
];

export function EmptyFeedState({ hasNotes, hasJournals }: EmptyFeedStateProps) {
  const navigate = useNavigate();

  const handleEntryClick = (entry: FeedEntry) => {
    // For sample entries, just show a message or navigate to the appropriate create page
    if (entry.type === 'journal') {
      navigate('/journal/new');
    } else {
      navigate('/notes');
    }
  };

  // Show welcome message with CTAs
  const renderWelcomeMessage = () => {
    if (!hasNotes && !hasJournals) {
      return (
        <div className="text-center py-8">
          <h3 className="text-xl text-text-default dark:text-text-dark-default mb-2">
            Welcome to Weft
          </h3>
          <p className="text-text-secondary dark:text-text-dark-secondary mb-6">
            Your video journaling application
          </p>
          <div className="flex gap-4 justify-center">
            <button
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors"
              onClick={() => navigate('/journal/new')}
            >
              Create Journal
            </button>
            <button
              className="px-6 py-2 bg-gray-100 dark:bg-gray-800 text-text-default dark:text-text-dark-default rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              onClick={() => navigate('/notes')}
            >
              Create Note
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
      {renderWelcomeMessage()}

      {/* Sample entries header */}
      {!hasJournals && (
        <>
          <div className="border-b-2 border-border-light dark:border-gray-700 my-4" />
          <h3 className="text-lg text-text-default dark:text-text-dark-default mb-4">
            See what your journal will look like:
          </h3>
        </>
      )}

      {/* Sample journal entries */}
      {!hasJournals && sampleJournals.map((entry) => (
        <FeedCard key={entry.id} entry={entry} onClick={() => handleEntryClick(entry)} />
      ))}

      {/* Sample notes */}
      {!hasNotes && hasJournals && (
        <>
          <div className="border-b-2 border-border-light dark:border-gray-700 my-4" />
          <h3 className="text-lg text-text-default dark:text-text-dark-default mb-4">
            See what your notes will look like:
          </h3>
        </>
      )}

      {!hasNotes && sampleNotes.map((entry) => (
        <FeedCard key={entry.id} entry={entry} onClick={() => handleEntryClick(entry)} />
      ))}
    </div>
  );
}
