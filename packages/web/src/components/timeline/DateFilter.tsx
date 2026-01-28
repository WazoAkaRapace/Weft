import { useState } from 'react';
import type { JournalListParams } from '@weft/shared';

interface DateFilterProps {
  onFilterChange: (params: Partial<JournalListParams>) => void;
  initialParams: JournalListParams;
}

export function DateFilter({ onFilterChange, initialParams }: DateFilterProps) {
  const [startDate, setStartDate] = useState<string>(
    initialParams.startDate ? initialParams.startDate.toISOString().split('T')[0] : ''
  );
  const [endDate, setEndDate] = useState<string>(
    initialParams.endDate ? initialParams.endDate.toISOString().split('T')[0] : ''
  );
  const [searchQuery, setSearchQuery] = useState(initialParams.search || '');

  const handleApplyFilter = () => {
    onFilterChange({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search: searchQuery || undefined,
    });
  };

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    onFilterChange({
      startDate: undefined,
      endDate: undefined,
      search: undefined,
    });
  };

  return (
    <div className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-2 flex-1 min-w-48">
          <label htmlFor="search" className="text-sm font-medium text-text-muted dark:text-text-dark-muted">
            Search
          </label>
          <input
            id="search"
            type="text"
            placeholder="Search titles or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-3 border border-border dark:border-border-dark rounded-lg text-base transition-colors focus:outline-none focus:border-border-focus"
          />
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-48">
          <label htmlFor="start-date" className="text-sm font-medium text-text-muted dark:text-text-dark-muted">
            From
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-3 border border-border dark:border-border-dark rounded-lg text-base transition-colors focus:outline-none focus:border-border-focus"
          />
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-48">
          <label htmlFor="end-date" className="text-sm font-medium text-text-muted dark:text-text-dark-muted">
            To
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-3 border border-border dark:border-border-dark rounded-lg text-base transition-colors focus:outline-none focus:border-border-focus"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleApplyFilter}
            className="px-6 py-3 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover"
          >
            Apply Filters
          </button>
          <button
            onClick={handleClearFilter}
            className="px-6 py-3 bg-white dark:bg-background-card-dark text-text-secondary dark:text-text-dark-secondary border border-border dark:border-border-dark rounded-lg font-medium cursor-pointer transition-colors hover:bg-background dark:hover:bg-background-dark"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
