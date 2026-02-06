/**
 * CollapsibleSection Component
 * A reusable collapsible/expandable section with chevron animation
 * Supports a custom header action element on the right side
 */

import { useState } from 'react';

export interface CollapsibleSectionProps {
  title: string;
  defaultExpanded?: boolean;
  children: (props: { isExpanded: boolean }) => React.ReactNode;
  headerAction?: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  defaultExpanded = true,
  children,
  headerAction,
  className = ''
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={className}>
      {/* Header - Always visible */}
      <div className="flex items-center justify-between py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left"
        >
          <h3 className="text-lg font-semibold text-text-default dark:text-text-dark-default">
            {title}
          </h3>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Header action (e.g., dropdown) */}
        {headerAction}
      </div>

      {/* Collapsible content */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {children({ isExpanded })}
      </div>
    </div>
  );
}
