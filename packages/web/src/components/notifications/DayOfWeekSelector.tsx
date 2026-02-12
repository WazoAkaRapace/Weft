/**
 * Day of Week Selector Component
 *
 * Toggle buttons for selecting which days of the week to receive notifications.
 */

import { useState, useEffect } from 'react';

const DAYS = [
  { value: 0, label: 'Su', fullLabel: 'Sunday' },
  { value: 1, label: 'Mo', fullLabel: 'Monday' },
  { value: 2, label: 'Tu', fullLabel: 'Tuesday' },
  { value: 3, label: 'We', fullLabel: 'Wednesday' },
  { value: 4, label: 'Th', fullLabel: 'Thursday' },
  { value: 5, label: 'Fr', fullLabel: 'Friday' },
  { value: 6, label: 'Sa', fullLabel: 'Saturday' },
];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];

interface DayOfWeekSelectorProps {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}

export function DayOfWeekSelector({ value, onChange, disabled = false }: DayOfWeekSelectorProps) {
  const [selectedDays, setSelectedDays] = useState<number[]>(value);

  useEffect(() => {
    setSelectedDays(value);
  }, [value]);

  const toggleDay = (day: number) => {
    if (disabled) return;

    // Prevent deselecting the last day
    if (selectedDays.length === 1 && selectedDays.includes(day)) {
      return;
    }

    const newDays = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day].sort((a, b) => a - b);

    setSelectedDays(newDays);
    onChange(newDays);
  };

  const selectAll = () => {
    if (disabled) return;
    setSelectedDays(ALL_DAYS);
    onChange(ALL_DAYS);
  };

  const selectWeekdays = () => {
    if (disabled) return;
    setSelectedDays(WEEKDAYS);
    onChange(WEEKDAYS);
  };

  const selectWeekends = () => {
    if (disabled) return;
    setSelectedDays(WEEKENDS);
    onChange(WEEKENDS);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {DAYS.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => toggleDay(day.value)}
            disabled={disabled}
            title={day.fullLabel}
            className={`
              w-8 h-8 text-xs font-medium rounded-md transition-colors
              ${selectedDays.includes(day.value)
                ? 'bg-teal-600 text-white'
                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {day.label}
          </button>
        ))}
      </div>

      {/* Quick select buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={selectAll}
          disabled={disabled}
          className="px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          All days
        </button>
        <span className="text-neutral-300 dark:text-neutral-600">|</span>
        <button
          type="button"
          onClick={selectWeekdays}
          disabled={disabled}
          className="px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Weekdays
        </button>
        <span className="text-neutral-300 dark:text-neutral-600">|</span>
        <button
          type="button"
          onClick={selectWeekends}
          disabled={disabled}
          className="px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Weekends
        </button>
      </div>
    </div>
  );
}
