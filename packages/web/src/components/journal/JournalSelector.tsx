import { useState, useEffect, useCallback } from 'react';
import { useJournals } from '../../hooks/useJournals';
import type { Journal } from '@weft/shared';
import { formatDuration } from '../../lib/video-stream';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface JournalSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onJournalSelect: (journalId: string) => Promise<void>;
  excludeIds?: string[];
}

export function JournalSelector({
  isOpen,
  onClose,
  onJournalSelect,
  excludeIds = [],
}: JournalSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Build params for useJournals
  const params = {
    page,
    limit,
    search: searchQuery || undefined,
  };

  const { journals, isLoading, error, refresh } = useJournals(params);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setPage(1);
    }
  }, [isOpen]);

  const handleSelect = async (journalId: string) => {
    await onJournalSelect(journalId);
    onClose();
  };

  // Filter out excluded journals
  const availableJournals = journals.filter((j) => !excludeIds.includes(j.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-dark-600">
          <h2 className="text-lg font-semibold text-text-default dark:text-text-dark-default">
            Link a Journal
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-neutral-200 dark:border-dark-600">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search journals..."
            className="w-full px-3 py-2 border border-neutral-200 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-900 text-text-default dark:text-text-dark-default"
            autoFocus
          />
        </div>

        {/* Journal List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && page === 1 ? (
            <div className="text-center py-8 text-text-secondary dark:text-text-dark-secondary">
              Loading journals...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-error">
              Error loading journals
            </div>
          ) : availableJournals.length === 0 ? (
            <div className="text-center py-8 text-text-secondary dark:text-text-dark-secondary">
              {searchQuery ? 'No journals match your search.' : 'No journals available to link.'}
            </div>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-dark-600">
              {availableJournals.map((journal) => (
                <JournalListItem
                  key={journal.id}
                  journal={journal}
                  onSelect={() => handleSelect(journal.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer - Load More */}
        {availableJournals.length >= limit && (
          <div className="p-4 border-t border-neutral-200 dark:border-dark-600">
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={isLoading}
              className="w-full px-4 py-2 text-sm border border-neutral-200 dark:border-dark-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface JournalListItemProps {
  journal: Journal;
  onSelect: () => void;
}

function JournalListItem({ journal, onSelect }: JournalListItemProps) {
  const journalDate = new Date(journal.createdAt);
  const formattedDate = journalDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-dark-700 cursor-pointer transition-colors"
    >
      {/* Thumbnail */}
      <div
        className="w-24 h-16 bg-cover bg-center rounded flex-shrink-0"
        style={{
          backgroundImage: journal.thumbnailPath
            ? `url(${API_BASE}${journal.thumbnailPath.replace(/^\/app/, '')})`
            : undefined,
          backgroundColor: !journal.thumbnailPath ? '#374151' : undefined,
        }}
      >
        {!journal.thumbnailPath && (
          <div className="w-full h-full flex items-center justify-center text-text-hint">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-text-default dark:text-text-dark-default truncate">
          {journal.title}
        </h3>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
            {formattedDate}
          </span>
          <span className="text-xs text-text-hint dark:text-text-dark-hint">
            {formatDuration(journal.duration)}
          </span>
          {journal.location && (
            <span className="text-xs text-text-hint dark:text-text-dark-hint flex items-center gap-1">
              📍 {journal.location}
            </span>
          )}
        </div>
        {journal.dominantEmotion && (
          <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-dark-600 text-text-secondary dark:text-text-dark-secondary">
            {journal.dominantEmotion}
          </span>
        )}
      </div>

      {/* Link indicator */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-primary-500 flex-shrink-0"
      >
        <path d="M5 12h14" />
        <path d="M12 5l7 7-7 7" />
      </svg>
    </div>
  );
}
