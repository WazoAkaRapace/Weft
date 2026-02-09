/**
 * DayCell Component
 * Individual calendar day cell showing mood indicator
 * Split into two halves: top = morning, bottom = afternoon
 */

import { format } from 'date-fns';
import type { DayCellProps, TimeOfDay } from './types';

const MOOD_COLORS: Record<string, { bg: string; border: string; text: string; darkBg: string; darkBorder: string; lightBg: string; lightDarkBg: string }> = {
  happy: {
    bg: 'bg-yellow-400',
    lightBg: 'bg-yellow-200/70',
    border: 'border-yellow-500',
    text: 'text-yellow-900',
    darkBg: 'dark:bg-yellow-600/50',
    lightDarkBg: 'dark:bg-yellow-700/30',
    darkBorder: 'dark:border-yellow-500',
  },
  sad: {
    bg: 'bg-blue-500',
    lightBg: 'bg-blue-300/70',
    border: 'border-blue-600',
    text: 'text-blue-900',
    darkBg: 'dark:bg-blue-700/50',
    lightDarkBg: 'dark:bg-blue-800/30',
    darkBorder: 'dark:border-blue-500',
  },
  angry: {
    bg: 'bg-red-500',
    lightBg: 'bg-red-300/70',
    border: 'border-red-600',
    text: 'text-red-900',
    darkBg: 'dark:bg-red-700/50',
    lightDarkBg: 'dark:bg-red-800/30',
    darkBorder: 'dark:border-red-500',
  },
  neutral: {
    bg: 'bg-slate-300',
    lightBg: 'bg-slate-200/70',
    border: 'border-slate-400',
    text: 'text-slate-800',
    darkBg: 'dark:bg-slate-600/50',
    lightDarkBg: 'dark:bg-slate-700/30',
    darkBorder: 'dark:border-slate-500',
  },
  sick: {
    bg: 'bg-lime-400',
    lightBg: 'bg-lime-200/70',
    border: 'border-lime-500',
    text: 'text-lime-900',
    darkBg: 'dark:bg-lime-700/50',
    lightDarkBg: 'dark:bg-lime-800/30',
    darkBorder: 'dark:border-lime-500',
  },
  anxious: {
    bg: 'bg-violet-500',
    lightBg: 'bg-violet-300/70',
    border: 'border-violet-600',
    text: 'text-violet-900',
    darkBg: 'dark:bg-violet-700/50',
    lightDarkBg: 'dark:bg-violet-800/30',
    darkBorder: 'dark:border-violet-500',
  },
  tired: {
    bg: 'bg-stone-500',
    lightBg: 'bg-stone-300/70',
    border: 'border-stone-600',
    text: 'text-stone-900',
    darkBg: 'dark:bg-stone-700/50',
    lightDarkBg: 'dark:bg-stone-800/30',
    darkBorder: 'dark:border-stone-500',
  },
  excited: {
    bg: 'bg-orange-500',
    lightBg: 'bg-orange-300/70',
    border: 'border-orange-600',
    text: 'text-orange-900',
    darkBg: 'dark:bg-orange-700/50',
    lightDarkBg: 'dark:bg-orange-800/30',
    darkBorder: 'dark:border-orange-500',
  },
  fear: {
    bg: 'bg-rose-500',
    lightBg: 'bg-rose-300/70',
    border: 'border-rose-600',
    text: 'text-rose-900',
    darkBg: 'dark:bg-rose-700/50',
    lightDarkBg: 'dark:bg-rose-800/30',
    darkBorder: 'dark:border-rose-500',
  },
  disgust: {
    bg: 'bg-green-500',
    lightBg: 'bg-green-300/70',
    border: 'border-green-600',
    text: 'text-green-900',
    darkBg: 'dark:bg-green-700/50',
    lightDarkBg: 'dark:bg-green-800/30',
    darkBorder: 'dark:border-green-500',
  },
  surprise: {
    bg: 'bg-sky-400',
    lightBg: 'bg-sky-200/70',
    border: 'border-sky-500',
    text: 'text-sky-900',
    darkBg: 'dark:bg-sky-700/50',
    lightDarkBg: 'dark:bg-sky-800/30',
    darkBorder: 'dark:border-sky-500',
  },
};

const EMOTION_COLORS: Record<string, string> = {
  happy: 'bg-yellow-500',
  sad: 'bg-blue-600',
  angry: 'bg-red-600',
  neutral: 'bg-slate-400',
  sick: 'bg-lime-500',
  anxious: 'bg-violet-600',
  tired: 'bg-stone-600',
  excited: 'bg-orange-600',
  fear: 'bg-rose-600',
  disgust: 'bg-green-600',
  surprise: 'bg-sky-500',
};

const MOOD_EMOJIS: Record<string, string> = {
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

export function DayCell({
  date,
  isCurrentMonth,
  isToday,
  data,
  onClick,
  isDisabled = false,
}: DayCellProps) {
  const dayNumber = format(date, 'd');
  const hasMorningMood = data?.morningMood !== null && data?.morningMood !== undefined;
  const hasAfternoonMood = data?.afternoonMood !== null && data?.afternoonMood !== undefined;
  const hasJournalEmotions = data?.journalEmotions && data.journalEmotions.length > 0;
  const hasMorningNotes = data?.morningNotes && data.morningNotes.trim().length > 0;
  const hasAfternoonNotes = data?.afternoonNotes && data.afternoonNotes.trim().length > 0;
  const hasAnyMood = hasMorningMood || hasAfternoonMood;

  const getCellStyles = () => {
    const baseStyles = 'aspect-square flex flex-col rounded transition-all relative text-xs overflow-hidden';

    if (!isCurrentMonth) {
      return `${baseStyles} text-neutral-300 dark:text-dark-600 cursor-default`;
    }

    if (isDisabled) {
      return `${baseStyles} text-neutral-400 dark:text-dark-500 cursor-not-allowed opacity-50`;
    }

    const todayStyles = isToday
      ? 'ring-1 ring-primary-500 ring-offset-1 dark:ring-offset-dark-900'
      : '';

    return `${baseStyles} ${todayStyles}`;
  };

  const getHalfStyles = (timeOfDay: TimeOfDay, mood: string | null) => {
    const baseHalfStyles = 'flex-1 flex flex-col items-center justify-center relative transition-all group';

    if (!isCurrentMonth || isDisabled) {
      return baseHalfStyles;
    }

    if (mood) {
      const colors = MOOD_COLORS[mood];
      const isMorning = timeOfDay === 'morning';
      // Use lighter opacity for morning, darker for afternoon
      const bgStyle = isMorning ? `${colors.lightBg} ${colors.lightDarkBg}` : `${colors.bg} ${colors.darkBg}`;
      return `${baseHalfStyles} ${bgStyle} hover:opacity-80 cursor-pointer`;
    }

    return `${baseHalfStyles} hover:bg-neutral-50 dark:hover:bg-dark-700/50 cursor-pointer`;
  };

  const getTimeBadge = (timeOfDay: TimeOfDay) => {
    return (
      <span className="absolute top-1 left-1 text-[10px] font-bold text-neutral-700 dark:text-dark-200 bg-white/90 dark:bg-dark-800/90 px-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        {timeOfDay === 'morning' ? 'am' : 'pm'}
      </span>
    );
  };

  const getJournalIndicator = () => {
    if (!hasJournalEmotions) return null;

    // If we have journal emotions but no manual mood, show the dominant emotion color
    if (!hasAnyMood && data?.journalEmotions && data.journalEmotions.length > 0) {
      const dominantEmotion = data.journalEmotions[0];
      const colorClass = EMOTION_COLORS[dominantEmotion] || 'bg-gray-400';
      return (
        <div
          className={`absolute top-1 right-1 w-2 h-2 rounded-full ${colorClass}`}
          aria-label="Journal emotion detected"
        />
      );
    }

    // If both exist, show a small dot indicator in the center
    return (
      <div
        className="absolute top-1/2 right-1 w-2 h-2 rounded-full bg-white dark:bg-dark-800 border border-neutral-400 dark:border-dark-500 -translate-y-1/2"
        aria-label="Has journal entries"
      />
    );
  };

  const getNotesIndicator = (timeOfDay: TimeOfDay) => {
    const hasNotes = timeOfDay === 'morning' ? hasMorningNotes : hasAfternoonNotes;
    if (!hasNotes) return null;

    const positionClass = timeOfDay === 'morning' ? 'top-0.5 left-0.5' : 'bottom-0.5 left-0.5';

    return (
      <div
        className={`absolute ${positionClass} w-1.5 h-1.5 rounded-full bg-amber-500`}
        aria-label={`${timeOfDay} has notes`}
      />
    );
  };

  const handleHalfClick = (e: React.MouseEvent, timeOfDay: TimeOfDay) => {
    e.stopPropagation();
    if (!isDisabled && isCurrentMonth) {
      onClick(timeOfDay);
    }
  };

  const handleHalfKeyDown = (e: React.KeyboardEvent, timeOfDay: TimeOfDay) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isDisabled && isCurrentMonth) {
        onClick(timeOfDay);
      }
    }
  };

  return (
    <div
      className={getCellStyles()}
      aria-label={`Day ${dayNumber}${hasMorningMood ? ` - morning: ${data?.morningMood}` : ''}${hasAfternoonMood ? ` - afternoon: ${data?.afternoonMood}` : ''}${hasJournalEmotions ? ' - has journal entries' : ''}`}
      aria-current={isToday ? 'date' : undefined}
    >
      {/* Morning Half - Top */}
      {isCurrentMonth && !isDisabled ? (
        <div
          className={getHalfStyles('morning', data?.morningMood || null)}
          onClick={(e) => handleHalfClick(e, 'morning')}
          onKeyDown={(e) => handleHalfKeyDown(e, 'morning')}
          role="button"
          tabIndex={0}
          aria-label={`Morning mood${hasMorningMood ? `: ${data?.morningMood}` : ''}`}
        >
          {getTimeBadge('morning')}
          {hasMorningMood && (
            <span className="text-base leading-none mb-0.5" aria-label={data?.morningMood}>
              {MOOD_EMOJIS[data?.morningMood || 'neutral']}
            </span>
          )}
          {getNotesIndicator('morning')}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {hasMorningMood && (
            <span className="text-base leading-none mb-0.5" aria-label={data?.morningMood}>
              {MOOD_EMOJIS[data?.morningMood || 'neutral']}
            </span>
          )}
          {getNotesIndicator('morning')}
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-neutral-200 dark:bg-dark-600 flex-shrink-0" />

      {/* Afternoon Half - Bottom */}
      {isCurrentMonth && !isDisabled ? (
        <div
          className={getHalfStyles('afternoon', data?.afternoonMood || null)}
          onClick={(e) => handleHalfClick(e, 'afternoon')}
          onKeyDown={(e) => handleHalfKeyDown(e, 'afternoon')}
          role="button"
          tabIndex={0}
          aria-label={`Afternoon mood${hasAfternoonMood ? `: ${data?.afternoonMood}` : ''}`}
        >
          {getTimeBadge('afternoon')}
          {hasAfternoonMood && (
            <span className="text-base leading-none mb-0.5" aria-label={data?.afternoonMood}>
              {MOOD_EMOJIS[data?.afternoonMood || 'neutral']}
            </span>
          )}
          {getNotesIndicator('afternoon')}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {hasAfternoonMood && (
            <span className="text-base leading-none mb-0.5" aria-label={data?.afternoonMood}>
              {MOOD_EMOJIS[data?.afternoonMood || 'neutral']}
            </span>
          )}
          {getNotesIndicator('afternoon')}
        </div>
      )}

      {/* Day number in center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-neutral-700 dark:text-dark-200 pointer-events-none bg-white/80 dark:bg-dark-900/80 px-1 rounded">
        {dayNumber}
      </div>

      {/* Journal indicator */}
      {getJournalIndicator()}
    </div>
  );
}
