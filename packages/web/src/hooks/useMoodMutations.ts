/**
 * Hook for mood mutations with automatic cache invalidation
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertMood as upsertMoodApi, deleteMood as deleteMoodApi } from '../lib/moodApi';
import type { MoodLogEntry } from '../components/calendar/types';
import type { TimeOfDay } from '../components/calendar/types';

export function useMoodMutations() {
  const queryClient = useQueryClient();

  const upsertMood = useMutation({
    mutationFn: (entry: MoodLogEntry) => upsertMoodApi(entry),
    onSuccess: (_, variables) => {
      const date = new Date(variables.date);
      queryClient.invalidateQueries({
        queryKey: ['calendarMoods', date.getFullYear(), date.getMonth()],
      });
    },
  });

  const deleteMood = useMutation({
    mutationFn: ({ date, timeOfDay }: { date: string; timeOfDay: TimeOfDay }) =>
      deleteMoodApi(date, timeOfDay),
    onSuccess: (_, variables) => {
      const date = new Date(variables.date);
      queryClient.invalidateQueries({
        queryKey: ['calendarMoods', date.getFullYear(), date.getMonth()],
      });
    },
  });

  return { upsertMood, deleteMood };
}
