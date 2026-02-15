/**
 * Hook for fetching and caching calendar mood data with React Query
 */

import { useQuery } from '@tanstack/react-query';
import { getCalendarMoods } from '../lib/moodApi';

export function useCalendarMoods(year: number, month: number) {
  return useQuery({
    queryKey: ['calendarMoods', year, month],
    queryFn: () => getCalendarMoods(year, month),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
