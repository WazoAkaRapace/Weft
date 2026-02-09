/**
 * MoodCalendarPage
 * Calendar view for tracking daily moods and journal emotions
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarView } from '../components/calendar/CalendarView';
import { MoodLogDialog } from '../components/calendar/MoodLogDialog';
import type { CalendarMonthData, MoodLogEntry, DailyMood, TimeOfDay } from '../components/calendar/types';
import { upsertMood, deleteMood, getCalendarMoods, getMood } from '../lib/moodApi';

const MOOD_EMOJIS: Record<DailyMood, string> = {
  happy: '😊',
  sad: '😢',
  angry: '😠',
  neutral: '😐',
  sick: '🤒',
  anxious: '😰',
  tired: '😴',
  excited: '🤩',
  fear: '😨',
  disgust: '🤢',
  surprise: '😮',
};

const MOOD_LABELS: Record<DailyMood, string> = {
  happy: 'Happy',
  sad: 'Sad',
  angry: 'Angry',
  neutral: 'Neutral',
  sick: 'Sick',
  anxious: 'Anxious',
  tired: 'Tired',
  excited: 'Excited',
  fear: 'Fear',
  disgust: 'Disgust',
  surprise: 'Surprise',
};

interface JournalEntry {
  id: string;
  dominantEmotion?: string;
  createdAt: string;
}

const MOOD_COLOR_CLASSES: Record<DailyMood, string> = {
  happy: 'bg-yellow-400 dark:bg-yellow-600/50',
  sad: 'bg-blue-500 dark:bg-blue-700/50',
  angry: 'bg-red-500 dark:bg-red-700/50',
  neutral: 'bg-slate-300 dark:bg-slate-600/50',
  sick: 'bg-lime-400 dark:bg-lime-700/50',
  anxious: 'bg-violet-500 dark:bg-violet-700/50',
  tired: 'bg-stone-500 dark:bg-stone-700/50',
  excited: 'bg-orange-500 dark:bg-orange-700/50',
  fear: 'bg-rose-500 dark:bg-rose-700/50',
  disgust: 'bg-green-500 dark:bg-green-700/50',
  surprise: 'bg-sky-400 dark:bg-sky-700/50',
};

function getMoodColorClass(mood: DailyMood): string {
  return MOOD_COLOR_CLASSES[mood];
}

export function MoodCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [_selectedDate, _setSelectedDate] = useState<Date | null>(null);
  const [dialogDate, setDialogDate] = useState<Date | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
  const [existingMood, setExistingMood] = useState<DailyMood | null>(null);
  const [existingNotes, setExistingNotes] = useState<string | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  // Calendar data
  const [monthData, setMonthData] = useState<CalendarMonthData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Compute statistics from the month data
  const stats = useMemo(() => {
    if (!monthData || monthData.days.size === 0) {
      return {
        daysLogged: 0,
        daysWithNotes: 0,
        daysWithJournalOnly: 0,
        mostCommonMood: null,
        moodCounts: new Map<DailyMood, number>(),
      };
    }

    const moodCounts = new Map<DailyMood, number>();
    const allMoods: DailyMood[] = ['happy', 'sad', 'angry', 'neutral', 'sick', 'anxious', 'tired', 'excited', 'fear', 'disgust', 'surprise'];
    for (const mood of allMoods) {
      moodCounts.set(mood, 0);
    }

    let daysWithNotes = 0;
    let daysWithJournalOnly = 0;

    // Count each mood and other stats - now counts both morning and afternoon
    for (const dayData of monthData.days.values()) {
      // Count morning mood
      if (dayData.morningMood) {
        const currentCount = moodCounts.get(dayData.morningMood) || 0;
        moodCounts.set(dayData.morningMood, currentCount + 1);
      }

      // Count afternoon mood
      if (dayData.afternoonMood) {
        const currentCount = moodCounts.get(dayData.afternoonMood) || 0;
        moodCounts.set(dayData.afternoonMood, currentCount + 1);
      }

      // Count notes from both morning and afternoon
      if ((dayData.morningNotes && dayData.morningNotes.trim().length > 0) ||
          (dayData.afternoonNotes && dayData.afternoonNotes.trim().length > 0)) {
        daysWithNotes++;
      }

      // Count days with only journal entries (no morning or afternoon mood)
      if (dayData.hasJournalEntries && !dayData.morningMood && !dayData.afternoonMood) {
        daysWithJournalOnly++;
      }
    }

    // Find the mood with the highest count
    let maxCount = 0;
    let mostCommonMood: DailyMood | null = null;
    for (const [mood, count] of moodCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonMood = mood;
      }
    }

    return {
      daysLogged: monthData.days.size,
      daysWithNotes,
      daysWithJournalOnly,
      mostCommonMood,
      moodCounts,
    };
  }, [monthData]);

  // Fetch calendar moods for a month
  const fetchMonthData = useCallback(async (date: Date) => {
    setIsLoading(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth();

      const response = await getCalendarMoods(year, month);
      if (response.data) {
        const daysMap = new Map();
        Object.entries(response.data.moods).forEach(([dateKey, moodData]) => {
          daysMap.set(dateKey, {
            date: new Date(dateKey),
            morningMood: moodData.morningMood as DailyMood | null,
            afternoonMood: moodData.afternoonMood as DailyMood | null,
            morningNotes: moodData.morningNotes || null,
            afternoonNotes: moodData.afternoonNotes || null,
            journalEmotions: moodData.journalEmotions || [],
            hasJournalEntries: moodData.hasJournal,
          });
        });
        setMonthData({
          year,
          month,
          days: daysMap,
        });
      } else {
        setMonthData({ year, month, days: new Map() });
      }
    } catch (error) {
      console.error('Failed to fetch calendar moods:', error);
      setMonthData({ year: date.getFullYear(), month: date.getMonth(), days: new Map() });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchMonthData(currentDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDateClick = useCallback(async (date: Date, clickedTimeOfDay?: TimeOfDay) => {
    _setSelectedDate(date);
    setDialogDate(date);
    setTimeOfDay(clickedTimeOfDay || 'morning');

    // Reset dialog state
    setExistingMood(null);
    setExistingNotes(null);
    setJournalEntries([]);

    // Fetch existing mood and journal entries for this date
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const response = await getMood(dateStr);

      if (response.data && Array.isArray(response.data)) {
        // Find the mood for the clicked time of day
        const moodForTimeOfDay = response.data.find(
          (mood) => mood.timeOfDay === (clickedTimeOfDay || 'morning')
        );
        if (moodForTimeOfDay) {
          setExistingMood(moodForTimeOfDay.mood as DailyMood | null);
          setExistingNotes(moodForTimeOfDay.notes);
        }
      }

      // TODO: Fetch journal entries for this date once API is available
      // For now, we'll show what the calendar API returns
      const calendarData = monthData?.days.get(dateStr);
      if (calendarData?.hasJournalEntries) {
        // Placeholder journal entries until we have a dedicated API
        setJournalEntries([{
          id: dateStr,
          dominantEmotion: calendarData.journalEmotions?.[0],
          createdAt: new Date(date).toISOString(),
        }]);
      }
    } catch (error) {
      console.error('Failed to fetch mood for date:', error);
    }
  }, [monthData]);

  const handleMonthChange = useCallback(
    (date: Date) => {
      setCurrentDate(date);
      fetchMonthData(date);
    },
    [fetchMonthData]
  );

  const handleSaveMood = useCallback(async (entry: MoodLogEntry) => {
    setIsSaving(true);
    try {
      await upsertMood(entry);

      // Refresh calendar data
      await fetchMonthData(currentDate);
    } catch (error) {
      console.error('Failed to save mood:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [currentDate, fetchMonthData]);

  const handleDeleteMood = useCallback(async () => {
    if (!dialogDate) return;

    try {
      await deleteMood(format(dialogDate, 'yyyy-MM-dd'), timeOfDay);

      // Refresh calendar data
      await fetchMonthData(currentDate);
    } catch (error) {
      console.error('Failed to delete mood:', error);
      throw error;
    }
  }, [currentDate, dialogDate, fetchMonthData, timeOfDay]);

  const handleCloseDialog = useCallback(() => {
    setDialogDate(null);
    setTimeOfDay('morning');
    setExistingMood(null);
    setExistingNotes(null);
    setJournalEntries([]);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-dark-50 mb-1">
          Mood Calendar
        </h1>
        <p className="text-sm text-neutral-600 dark:text-dark-400">
          Track your mood and emotions over time
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar - Takes up 2 columns */}
        <div className="lg:col-span-2">
          <CalendarView
            currentDate={currentDate}
            onDateClick={handleDateClick}
            onMonthChange={handleMonthChange}
            monthData={monthData}
            isLoading={isLoading}
          />

          {/* Mood Legend */}
          <div className="mt-4 bg-white dark:bg-dark-800 rounded-lg border border-neutral-200 dark:border-dark-600 p-4">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-dark-300 mb-3">
              Mood Legend
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {Object.entries(MOOD_EMOJIS).map(([mood, emoji]) => (
                <div key={mood} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full ${getMoodColorClass(mood as DailyMood)}`} />
                  <span className="text-base">{emoji}</span>
                  <span className="text-sm text-neutral-600 dark:text-dark-400">{MOOD_LABELS[mood as DailyMood]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-4 mt-[38px]">
          {/* Monthly Stats */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-neutral-200 dark:border-dark-600 p-4">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-dark-300 mb-3">
              This Month
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-neutral-600 dark:text-dark-400">Days logged</span>
                <span className="font-medium text-neutral-900 dark:text-dark-50">
                  {stats.daysLogged}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600 dark:text-dark-400">With notes</span>
                <span className="font-medium text-neutral-900 dark:text-dark-50">
                  {stats.daysWithNotes}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600 dark:text-dark-400">Journal only</span>
                <span className="font-medium text-neutral-900 dark:text-dark-50">
                  {stats.daysWithJournalOnly}
                </span>
              </div>
            </div>
          </div>

          {/* Most Common Mood */}
          {stats.mostCommonMood && (
            <div className="bg-white dark:bg-dark-800 rounded-lg border border-neutral-200 dark:border-dark-600 p-4">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-dark-300 mb-3">
                Most Common Mood
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{MOOD_EMOJIS[stats.mostCommonMood]}</span>
                <span className="font-medium text-neutral-900 dark:text-dark-50">
                  {MOOD_LABELS[stats.mostCommonMood]}
                </span>
                <span className="text-xs text-neutral-500 dark:text-dark-400">
                  ({stats.moodCounts.get(stats.mostCommonMood) || 0} days)
                </span>
              </div>
            </div>
          )}

          {/* Mood Distribution */}
          {stats.daysLogged > 0 && (
            <div className="bg-white dark:bg-dark-800 rounded-lg border border-neutral-200 dark:border-dark-600 p-4">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-dark-300 mb-3">
                Mood Distribution
              </h3>
              <div className="space-y-2 text-xs">
                {Array.from(stats.moodCounts.entries())
                  .filter(([_, count]) => count > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([mood, count]) => (
                    <div key={mood} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span>{MOOD_EMOJIS[mood]}</span>
                        <span className="text-neutral-600 dark:text-dark-400">{MOOD_LABELS[mood]}</span>
                      </span>
                      <span className="font-medium text-neutral-900 dark:text-dark-50">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mood Log Dialog */}
      {dialogDate && (
        <MoodLogDialog
          isOpen={true}
          date={dialogDate}
          timeOfDay={timeOfDay}
          existingMood={existingMood}
          existingNotes={existingNotes}
          journalEntries={journalEntries}
          onClose={handleCloseDialog}
          onSave={handleSaveMood}
          onDelete={existingMood ? handleDeleteMood : undefined}
          isLoading={isSaving}
        />
      )}
    </div>
  );
}
