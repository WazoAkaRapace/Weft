import type { Journal } from '@weft/shared';

interface TimelineViewProps {
  journals: Journal[];
  onJournalClick: (journalId: string) => void;
  isLoading: boolean;
  formatDuration: (seconds: number) => string;
}

export function TimelineView({
  journals,
  onJournalClick,
  isLoading,
  formatDuration,
}: TimelineViewProps) {
  // Group journals by date
  const groupedJournals = journals.reduce((acc, journal) => {
    const date = new Date(journal.createdAt).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(journal);
    return acc;
  }, {} as Record<string, Journal[]>);

  const dates = Object.keys(groupedJournals).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="timeline-view">
      {dates.map((date) => (
        <div key={date} className="timeline-day">
          <div className="timeline-date">
            <h3>{formatDate(date)}</h3>
            <span className="journal-count">
              {groupedJournals[date].length} {groupedJournals[date].length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          <div className="timeline-entries">
            {groupedJournals[date].map((journal) => (
              <div
                key={journal.id}
                className="timeline-entry"
                onClick={() => onJournalClick(journal.id)}
              >
                <div className="entry-thumbnail">
                  {journal.thumbnailPath ? (
                    <img
                      src={`${journal.thumbnailPath.replace('/app', '')}`}
                      alt={journal.title}
                      className="thumbnail-image"
                    />
                  ) : (
                    <div className="thumbnail-placeholder" />
                  )}
                  <span className="duration-badge">
                    {formatDuration(journal.duration)}
                  </span>
                </div>

                <div className="entry-content">
                  <h4 className="entry-title">{journal.title}</h4>
                  <p className="entry-time">
                    {formatTime(journal.createdAt)}
                  </p>
                  {journal.notes && (
                    <p className="entry-notes">{journal.notes}</p>
                  )}
                  {journal.location && (
                    <p className="entry-location">📍 {journal.location}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="loading-indicator">
          Loading more journals...
        </div>
      )}
    </div>
  );
}

// Helper functions
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
