import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Journal } from '@weft/shared';
import { formatDuration } from '../../lib/video-stream';
import { JournalSelector } from './JournalSelector';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface JournalLinkerProps {
  noteId: string;
  linkedJournals: Journal[];
  onLink: (journalId: string) => Promise<void>;
  onUnlink: (journalId: string) => Promise<void>;
  onJournalClick?: (journalId: string) => void;
  isLoading?: boolean;
}

export function JournalLinker({
  linkedJournals,
  onLink,
  onUnlink,
  onJournalClick,
  isLoading = false,
}: JournalLinkerProps) {
  const navigate = useNavigate();
  const [showSelector, setShowSelector] = useState(false);
  const [journalToUnlink, setJournalToUnlink] = useState<Journal | null>(null);

  const handleUnlink = (journal: Journal, e: React.MouseEvent) => {
    e.stopPropagation();
    setJournalToUnlink(journal);
  };

  const confirmUnlink = async () => {
    if (journalToUnlink) {
      await onUnlink(journalToUnlink.id);
      setJournalToUnlink(null);
    }
  };

  const handleJournalClick = (journalId: string) => {
    if (onJournalClick) {
      onJournalClick(journalId);
    } else {
      navigate(`/journal/${journalId}`);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary">
            Linked Journals
          </h4>
          <button
            onClick={() => setShowSelector(true)}
            className="text-xs px-2 py-1 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
          >
            + Add Journal
          </button>
        </div>

        {isLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-48 bg-neutral-100 dark:bg-dark-700 rounded-lg h-20 animate-pulse"
              />
            ))}
          </div>
        ) : linkedJournals.length === 0 ? (
          <p className="text-xs text-text-hint dark:text-text-dark-hint italic">
            No journals linked to this note yet.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
            {linkedJournals.map((journal) => (
              <JournalCard
                key={journal.id}
                journal={journal}
                onClick={() => handleJournalClick(journal.id)}
                onUnlink={handleUnlink}
              />
            ))}
          </div>
        )}
      </div>

      {showSelector && (
        <JournalSelector
          isOpen={showSelector}
          onClose={() => setShowSelector(false)}
          onJournalSelect={async (journalId) => {
            await onLink(journalId);
            setShowSelector(false);
          }}
          excludeIds={linkedJournals.map((j) => j.id)}
        />
      )}

      {journalToUnlink && (
        <ConfirmDialog
          isOpen={!!journalToUnlink}
          title="Unlink Journal"
          message={`Are you sure you want to unlink "${journalToUnlink.title}" from this note?`}
          confirmLabel="Unlink"
          cancelLabel="Cancel"
          onConfirm={confirmUnlink}
          onCancel={() => setJournalToUnlink(null)}
        />
      )}
    </>
  );
}

interface JournalCardProps {
  journal: Journal;
  onClick: () => void;
  onUnlink: (journal: Journal, e: React.MouseEvent) => void;
}

function JournalCard({ journal, onClick, onUnlink }: JournalCardProps) {
  const journalDate = new Date(journal.createdAt);
  const formattedDate = journalDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="group relative flex-shrink-0 w-48 bg-neutral-50 dark:bg-dark-700 rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]">
      {/* Thumbnail */}
      <div
        className="h-20 bg-cover bg-center"
        style={{
          backgroundImage: journal.thumbnailPath
            ? `url(${API_BASE}${journal.thumbnailPath.replace(/^\/app/, '')})`
            : undefined,
          backgroundColor: !journal.thumbnailPath ? '#374151' : undefined,
        }}
        onClick={onClick}
      >
        {!journal.thumbnailPath && (
          <div className="w-full h-full flex items-center justify-center text-text-hint">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2" onClick={onClick}>
        <h5 className="text-sm font-medium text-text-default dark:text-text-dark-default truncate">
          {journal.title}
        </h5>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
            {formattedDate}
          </span>
          <span className="text-xs text-text-hint dark:text-text-dark-hint">
            {formatDuration(journal.duration)}
          </span>
        </div>
      </div>

      {/* Unlink Button */}
      <button
        onClick={(e) => onUnlink(journal, e)}
        className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-dark-800 rounded shadow-sm hover:bg-neutral-100 dark:hover:bg-dark-600"
        title="Unlink journal"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-text-secondary"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
