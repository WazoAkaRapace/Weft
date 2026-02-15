import { useNavigate } from 'react-router-dom';
import { useNotes } from '../hooks/useNotes';
import { useJournals } from '../hooks/useJournals';
import { useMoodMutations } from '../hooks/useMoodMutations';
import { FeedList } from '../components/feed/FeedList';
import { MoodPromptCard } from '../components/feed/MoodPromptCard';
import { QuickMoodDialog } from '../components/feed/QuickMoodDialog';
import type { FeedEntry, DailyMood, TimeOfDay, MoodValue } from '@weft/shared';
import { getMood } from '../lib/moodApi';
import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';

export function DashboardPage() {
  const navigate = useNavigate();
  const { notes, isLoading: isLoadingNotes } = useNotes();
  const { journals, isLoading: isLoadingJournals } = useJournals({ page: 1, limit: 10 });
  const { upsertMood } = useMoodMutations();
  const [moodsByDate, setMoodsByDate] = useState<Record<string, DailyMood[]>>({});
  const [todayMoods, setTodayMoods] = useState<DailyMood[]>([]);
  const [showMoodDialog, setShowMoodDialog] = useState(false);
  const [pendingTimeOfDay, setPendingTimeOfDay] = useState<TimeOfDay | null>(null);

  // Filter out deleted notes and convert to FeedEntry format
  const noteEntries: FeedEntry[] = useMemo(() => notes
    .filter(note => !note.deletedAt)
    .map(note => ({
      id: note.id,
      type: 'note' as const,
      timestamp: new Date(note.createdAt),
      title: note.title,
      icon: note.icon,
    })), [notes]);

  // Convert journals to FeedEntry format
  const journalEntries: FeedEntry[] = useMemo(() => journals.map(journal => ({
    id: journal.id,
    type: 'journal' as const,
    timestamp: new Date(journal.createdAt),
    title: journal.title,
    thumbnailPath: journal.thumbnailPath,
    duration: journal.duration,
    dominantEmotion: journal.dominantEmotion,
    manualMood: journal.manualMood,
  })), [journals]);

  // Merge and sort by timestamp (newest first), limit to 10 total
  const allEntries: FeedEntry[] = useMemo(() => [...noteEntries, ...journalEntries]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10), [noteEntries, journalEntries]);

  const isLoading = isLoadingNotes || isLoadingJournals;

  // Get unique dates from entries and fetch moods for those dates
  useEffect(() => {
    const fetchMoodsForDates = async () => {
      if (allEntries.length === 0) return;

      const uniqueDates = Array.from(
        new Set(
          allEntries.map(entry =>
            new Date(entry.timestamp).toISOString().split('T')[0]
          )
        )
      );

      const moodsData: Record<string, DailyMood[]> = {};

      try {
        for (const date of uniqueDates) {
          // Skip if we already have this date's moods
          if (moodsByDate[date]) continue;

          const response = await getMood(date);
          if (response.data) {
            moodsData[date] = response.data;
          }
        }
        // Only update if we have new data
        if (Object.keys(moodsData).length > 0) {
          setMoodsByDate(prev => ({ ...prev, ...moodsData }));
        }
      } catch (error) {
        console.error('Failed to fetch moods:', error);
      }
    };

    fetchMoodsForDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only re-run when the number of entries changes
  }, [allEntries.length]);

  // Fetch today's mood data
  useEffect(() => {
    const fetchTodayMood = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      try {
        const response = await getMood(today);
        if (response.data) {
          setTodayMoods(response.data);
          // Also add to moodsByDate for display in the feed
          setMoodsByDate(prev => ({ ...prev, [today]: response.data }));
        }
      } catch (error) {
        console.error('Failed to fetch today mood:', error);
      }
    };

    fetchTodayMood();
  }, []);

  // Determine if we should show mood prompt
  const shouldShowMorningPrompt = () => {
    const hour = new Date().getHours();
    const hasMorningMood = todayMoods.some(m => m.timeOfDay === 'morning');
    return hour < 12 && !hasMorningMood;
  };

  const shouldShowAfternoonPrompt = () => {
    const hour = new Date().getHours();
    const hasAfternoonMood = todayMoods.some(m => m.timeOfDay === 'afternoon');
    return hour >= 12 && !hasAfternoonMood;
  };

  const showMoodPrompt = shouldShowMorningPrompt() || shouldShowAfternoonPrompt();

  const handleMoodPromptClick = () => {
    if (shouldShowMorningPrompt()) {
      setPendingTimeOfDay('morning');
    } else if (shouldShowAfternoonPrompt()) {
      setPendingTimeOfDay('afternoon');
    }
    setShowMoodDialog(true);
  };

  const handleSaveMood = async (mood: string, notes: string | null) => {
    if (!pendingTimeOfDay) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      await upsertMood.mutateAsync({
        date: today,
        mood: mood as MoodValue,
        timeOfDay: pendingTimeOfDay,
        notes: notes || undefined,
      });

      // Refresh today's mood data
      const response = await getMood(today);
      if (response.data) {
        setTodayMoods(response.data);
        // Also update moodsByDate so the feed displays the new mood
        setMoodsByDate(prev => ({ ...prev, [today]: response.data }));
      }

      setShowMoodDialog(false);
      setPendingTimeOfDay(null);
    } catch (error) {
      console.error('Failed to save mood:', error);
    }
  };

  const handleCloseDialog = () => {
    setShowMoodDialog(false);
    setPendingTimeOfDay(null);
  };

  const handleEntryClick = (entry: FeedEntry) => {
    if (entry.type === 'journal') {
      navigate(`/journal/${entry.id}`);
    } else {
      navigate(`/notes/${entry.id}`);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {showMoodPrompt && (
        <MoodPromptCard
          timeOfDay={shouldShowMorningPrompt() ? 'morning' : 'afternoon'}
          onClick={handleMoodPromptClick}
        />
      )}
      <FeedList
        entries={allEntries}
        isLoading={isLoading}
        hasNotes={noteEntries.length > 0}
        hasJournals={journalEntries.length > 0}
        onEntryClick={handleEntryClick}
        moodsByDate={moodsByDate}
      />
      {showMoodDialog && pendingTimeOfDay && (
        <QuickMoodDialog
          isOpen={showMoodDialog}
          timeOfDay={pendingTimeOfDay}
          onClose={handleCloseDialog}
          onSave={handleSaveMood}
          isLoading={upsertMood.isPending}
        />
      )}
    </div>
  );
}
