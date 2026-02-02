import { useNavigate } from 'react-router-dom';
import { useNotes } from '../hooks/useNotes';
import { useJournals } from '../hooks/useJournals';
import { FeedList } from '../components/feed/FeedList';
import type { FeedEntry } from '@weft/shared';

export function DashboardPage() {
  const navigate = useNavigate();
  const { notes, isLoading: isLoadingNotes, error: notesError } = useNotes();
  const { journals, isLoading: isLoadingJournals, error: journalsError } = useJournals({ page: 1, limit: 10 });

  // Filter out deleted notes and convert to FeedEntry format
  const noteEntries: FeedEntry[] = notes
    .filter(note => !note.deletedAt)
    .map(note => ({
      id: note.id,
      type: 'note' as const,
      timestamp: new Date(note.createdAt),
      title: note.title,
      icon: note.icon,
    }));

  // Convert journals to FeedEntry format
  const journalEntries: FeedEntry[] = journals.map(journal => ({
    id: journal.id,
    type: 'journal' as const,
    timestamp: new Date(journal.createdAt),
    title: journal.title,
    thumbnailPath: journal.thumbnailPath,
    duration: journal.duration,
    dominantEmotion: journal.dominantEmotion,
  }));

  // Merge and sort by timestamp (newest first), limit to 10 total
  const allEntries: FeedEntry[] = [...noteEntries, ...journalEntries]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10);

  const isLoading = isLoadingNotes || isLoadingJournals;

  const handleEntryClick = (entry: FeedEntry) => {
    if (entry.type === 'journal') {
      navigate(`/journal/${entry.id}`);
    } else {
      navigate(`/notes/${entry.id}`);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <FeedList
        entries={allEntries}
        isLoading={isLoading}
        hasNotes={noteEntries.length > 0}
        hasJournals={journalEntries.length > 0}
        onEntryClick={handleEntryClick}
      />
    </div>
  );
}
