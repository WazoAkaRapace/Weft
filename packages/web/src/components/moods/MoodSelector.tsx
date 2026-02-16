/**
 * MoodSelector Component
 * Dropdown selector for manual mood selection
 */

import { useState } from 'react';
import { EMOTION_CONFIG, type EmotionLabel } from '../emotions/types';
import { ThemeIcon } from '../ui/ThemeIcon';

export interface MoodSelectorProps {
  value: EmotionLabel | null;
  onChange: (mood: EmotionLabel | null) => void;
  disabled?: boolean;
  className?: string;
}

const MOOD_OPTIONS: { value: EmotionLabel | null; label: string }[] = [
  { value: null, label: 'Auto (Detected)' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'happy', label: 'Happy' },
  { value: 'sad', label: 'Sad' },
  { value: 'angry', label: 'Angry' },
  { value: 'fear', label: 'Fear' },
  { value: 'disgust', label: 'Disgusted' },
  { value: 'surprise', label: 'Surprised' },
];

export function MoodSelector({ value, onChange, disabled = false, className = '' }: MoodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const config = value ? EMOTION_CONFIG[value] : null;

  const handleSelect = (mood: EmotionLabel | null) => {
    onChange(mood);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
          transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800'}
          bg-gray-50 dark:bg-gray-800/50
          border border-gray-200 dark:border-gray-700
          text-gray-700 dark:text-gray-300
        `}
      >
        {config ? (
          <>
            <span className="text-base">{config.icon}</span>
            <span>{config.label}</span>
          </>
        ) : (
          <>
            <ThemeIcon name="ai" alt="" size={20} />
            <span>Auto (Detected)</span>
          </>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]">
            {MOOD_OPTIONS.map((option) => {
              const isSelected = value === option.value;
              const optionConfig = option.value ? EMOTION_CONFIG[option.value] : null;

              return (
                <button
                  key={option.value ?? 'auto'}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full text-left px-3 py-2 text-sm flex items-center gap-2
                    transition-colors
                    ${isSelected
                      ? 'bg-primary text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  {optionConfig ? (
                    <>
                      <span className="text-base">{optionConfig.icon}</span>
                      <span>{optionConfig.label}</span>
                    </>
                  ) : (
                    <>
                      <ThemeIcon name="ai" alt="" size={20} />
                      <span>{option.label}</span>
                    </>
                  )}
                  {isSelected && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="ml-auto"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
