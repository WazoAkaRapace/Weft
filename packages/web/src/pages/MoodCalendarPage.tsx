/**
 * MoodCalendarPage
 * Calendar view for tracking daily moods and journal emotions
 */

import { useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarView } from '../components/calendar/CalendarView';
import { MoodLogDialog } from '../components/calendar/MoodLogDialog';
import type { CalendarMonthData, MoodLogEntry, DailyMood, TimeOfDay } from '../components/calendar/types';
import { getMood } from '../lib/moodApi';
import { useCalendarMoods } from '../hooks/useCalendarMoods';
import { useMoodMutations } from '../hooks/useMoodMutations';

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

  // React Query hooks for data fetching and mutations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const { data: response, isLoading } = useCalendarMoods(year, month);
  const { upsertMood, deleteMood } = useMoodMutations();

  // Transform API response to monthData
  const monthData = useMemo<CalendarMonthData | null>(() => {
    if (!response?.data) return null;
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
    return { year, month, days: daysMap };
  }, [response, year, month]);

  // Compute statistics from the month data
  const stats = useMemo(() => {
    if (!monthData || monthData.days.size === 0) {
      return {
        daysLogged: 0,
        daysWithNotes: 0,
        daysWithJournalOnly: 0,
        mostCommonMood: null,
        moodCounts: new Map<DailyMood, number>(),
        mostCommonMorningMood: null,
        morningMoodCounts: new Map<DailyMood, number>(),
        mostCommonAfternoonMood: null,
        afternoonMoodCounts: new Map<DailyMood, number>(),
        mostCommonAfternoonByMorning: new Map<DailyMood, { mood: DailyMood; count: number }>(),
      };
    }

    const moodCounts = new Map<DailyMood, number>();
    const morningMoodCounts = new Map<DailyMood, number>();
    const afternoonMoodCounts = new Map<DailyMood, number>();
    const allMoods: DailyMood[] = ['happy', 'sad', 'angry', 'neutral', 'sick', 'anxious', 'tired', 'excited', 'fear', 'disgust', 'surprise'];
    for (const mood of allMoods) {
      moodCounts.set(mood, 0);
      morningMoodCounts.set(mood, 0);
      afternoonMoodCounts.set(mood, 0);
    }

    // Track afternoon moods for each morning mood
    const moodTransitions = new Map<DailyMood, Map<DailyMood, number>>();
    for (const mood of allMoods) {
      moodTransitions.set(mood, new Map<DailyMood, number>());
      for (const afternoonMood of allMoods) {
        moodTransitions.get(mood)?.set(afternoonMood, 0);
      }
    }

    let daysWithNotes = 0;
    let daysWithJournalOnly = 0;

    // Count each mood and other stats - now counts both morning and afternoon
    for (const dayData of monthData.days.values()) {
      // Count morning mood in combined and separate maps
      if (dayData.morningMood) {
        const currentCount = moodCounts.get(dayData.morningMood) || 0;
        moodCounts.set(dayData.morningMood, currentCount + 1);
        const morningCount = morningMoodCounts.get(dayData.morningMood) || 0;
        morningMoodCounts.set(dayData.morningMood, morningCount + 1);
      }

      // Count afternoon mood in combined and separate maps
      if (dayData.afternoonMood) {
        const currentCount = moodCounts.get(dayData.afternoonMood) || 0;
        moodCounts.set(dayData.afternoonMood, currentCount + 1);
        const afternoonCount = afternoonMoodCounts.get(dayData.afternoonMood) || 0;
        afternoonMoodCounts.set(dayData.afternoonMood, afternoonCount + 1);
      }

      // Track mood transitions (morning → afternoon on same day)
      if (dayData.morningMood && dayData.afternoonMood) {
        const transitionMap = moodTransitions.get(dayData.morningMood);
        if (transitionMap) {
          const currentCount = transitionMap.get(dayData.afternoonMood) || 0;
          transitionMap.set(dayData.afternoonMood, currentCount + 1);
        }
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

    // Find most common morning mood
    let maxMorningCount = 0;
    let mostCommonMorningMood: DailyMood | null = null;
    for (const [mood, count] of morningMoodCounts.entries()) {
      if (count > maxMorningCount) {
        maxMorningCount = count;
        mostCommonMorningMood = mood;
      }
    }

    // Find most common afternoon mood
    let maxAfternoonCount = 0;
    let mostCommonAfternoonMood: DailyMood | null = null;
    for (const [mood, count] of afternoonMoodCounts.entries()) {
      if (count > maxAfternoonCount) {
        maxAfternoonCount = count;
        mostCommonAfternoonMood = mood;
      }
    }

    // Find most common afternoon mood for each morning mood
    const mostCommonAfternoonByMorning = new Map<DailyMood, { mood: DailyMood; count: number }>();
    for (const [morningMood, afternoonCounts] of moodTransitions.entries()) {
      let maxTransitionCount = 0;
      let mostCommonAfternoon: DailyMood | null = null;
      for (const [afternoonMood, count] of afternoonCounts.entries()) {
        if (count > maxTransitionCount) {
          maxTransitionCount = count;
          mostCommonAfternoon = afternoonMood;
        }
      }
      if (mostCommonAfternoon && maxTransitionCount > 0) {
        mostCommonAfternoonByMorning.set(morningMood, { mood: mostCommonAfternoon, count: maxTransitionCount });
      }
    }

    return {
      daysLogged: monthData.days.size,
      daysWithNotes,
      daysWithJournalOnly,
      mostCommonMood,
      moodCounts,
      mostCommonMorningMood,
      morningMoodCounts,
      mostCommonAfternoonMood,
      afternoonMoodCounts,
      mostCommonAfternoonByMorning,
    };
  }, [monthData]);

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
      const moodResponse = await getMood(dateStr);

      if (moodResponse.data && Array.isArray(moodResponse.data)) {
        // Find the mood for the clicked time of day
        const moodForTimeOfDay = moodResponse.data.find(
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

  const handleMonthChange = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const handleSaveMood = useCallback(async (entry: MoodLogEntry) => {
    await upsertMood.mutateAsync(entry);
  }, [upsertMood]);

  const handleDeleteMood = useCallback(async () => {
    if (!dialogDate) return;
    await deleteMood.mutateAsync({
      date: format(dialogDate, 'yyyy-MM-dd'),
      timeOfDay,
    });
  }, [dialogDate, deleteMood, timeOfDay]);

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
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{MOOD_EMOJIS[stats.mostCommonMood]}</span>
                <span className="font-medium text-neutral-900 dark:text-dark-50">
                  {MOOD_LABELS[stats.mostCommonMood]}
                </span>
                <span className="text-xs text-neutral-500 dark:text-dark-400">
                  ({stats.moodCounts.get(stats.mostCommonMood) || 0} days)
                </span>
              </div>
              {(stats.mostCommonMorningMood || stats.mostCommonAfternoonMood) && (
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-200 dark:border-dark-600">
                  {stats.mostCommonMorningMood && (
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-dark-400 mb-1">Morning</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">{MOOD_EMOJIS[stats.mostCommonMorningMood]}</span>
                        <span className="text-sm font-medium text-neutral-900 dark:text-dark-50">
                          {MOOD_LABELS[stats.mostCommonMorningMood]}
                        </span>
                        <span className="text-xs text-neutral-400 dark:text-dark-500">
                          ({stats.morningMoodCounts.get(stats.mostCommonMorningMood) || 0})
                        </span>
                      </div>
                    </div>
                  )}
                  {stats.mostCommonAfternoonMood && (
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-dark-400 mb-1">Afternoon</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">{MOOD_EMOJIS[stats.mostCommonAfternoonMood]}</span>
                        <span className="text-sm font-medium text-neutral-900 dark:text-dark-50">
                          {MOOD_LABELS[stats.mostCommonAfternoonMood]}
                        </span>
                        <span className="text-xs text-neutral-400 dark:text-dark-500">
                          ({stats.afternoonMoodCounts.get(stats.mostCommonAfternoonMood) || 0})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
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

          {/* Mood Transitions: Morning → Afternoon */}
          {stats.mostCommonAfternoonByMorning.size > 0 && (
            <div className="bg-white dark:bg-dark-800 rounded-lg border border-neutral-200 dark:border-dark-600 p-4">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-dark-300 mb-3">
                Morning → Afternoon
              </h3>
              <p className="text-xs text-neutral-500 dark:text-dark-400 mb-3">
                Most likely afternoon mood for each morning mood
              </p>
              <div className="space-y-2 text-xs">
                {Array.from(stats.mostCommonAfternoonByMorning.entries())
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([morningMood, { mood: afternoonMood, count }]) => (
                    <div key={morningMood} className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>{MOOD_EMOJIS[morningMood]}</span>
                        <span className="text-neutral-600 dark:text-dark-400">{MOOD_LABELS[morningMood]}</span>
                        <span className="text-neutral-400 mx-1">→</span>
                        <span>{MOOD_EMOJIS[afternoonMood]}</span>
                        <span className="text-neutral-600 dark:text-dark-400">{MOOD_LABELS[afternoonMood]}</span>
                      </span>
                      <span className="text-neutral-500 dark:text-dark-400">
                        {count}x
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
          isLoading={upsertMood.isPending}
        />
      )}
    </div>
  );
}
