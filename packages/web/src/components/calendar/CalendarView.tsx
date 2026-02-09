/**
 * CalendarView Component
 * Monthly calendar grid with mood indicators
 */

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { DayCell } from './DayCell';
import type { CalendarViewProps } from './types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarView({
  currentDate,
  onDateClick,
  onMonthChange,
  monthData,
  isLoading = false,
}: CalendarViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the first day of the month to add padding days
  const firstDayOfWeek = monthStart.getDay();

  // Add padding days for the first week
  const paddingDays = Array.from({ length: firstDayOfWeek }, (_, i) => {
    const date = new Date(monthStart);
    date.setDate(date.getDate() - (firstDayOfWeek - i));
    return date;
  });

  // Get the last day of the calendar grid
  const lastDayOfWeek = monthEnd.getDay();
  const remainingDays = (6 - lastDayOfWeek) % 7;

  // Add padding days for the last week
  const trailingDays = Array.from({ length: remainingDays }, (_, i) => {
    const date = new Date(monthEnd);
    date.setDate(date.getDate() + (i + 1));
    return date;
  });

  const allDays = [...paddingDays, ...calendarDays, ...trailingDays];

  const getDayData = (date: Date) => {
    if (!monthData) return undefined;
    const key = format(date, 'yyyy-MM-dd');
    return monthData.days.get(key);
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onMonthChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onMonthChange(newDate);
  };

  const handleToday = () => {
    onMonthChange(new Date());
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="w-full">
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handlePrevMonth}
          disabled={isLoading}
          className="p-1.5 rounded-md bg-neutral-100 dark:bg-dark-800 hover:bg-neutral-200 dark:hover:bg-dark-700 text-neutral-700 dark:text-dark-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous month"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-dark-50">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={handleToday}
            disabled={isLoading}
            className="px-2 py-0.5 rounded-md bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Today
          </button>
        </div>

        <button
          onClick={handleNextMonth}
          disabled={isLoading}
          className="p-1.5 rounded-md bg-neutral-100 dark:bg-dark-800 hover:bg-neutral-200 dark:hover:bg-dark-700 text-neutral-700 dark:text-dark-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next month"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-neutral-200 dark:border-dark-600 p-2">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-neutral-500 dark:text-dark-400 py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-0.5">
          {allDays.map((date, index) => (
            <DayCell
              key={`${format(date, 'yyyy-MM-dd')}-${index}`}
              date={date}
              isCurrentMonth={isSameMonth(date, currentDate)}
              isToday={isToday(date)}
              data={getDayData(date)}
              onClick={(timeOfDay) => onDateClick(date, timeOfDay)}
              isDisabled={isLoading}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
