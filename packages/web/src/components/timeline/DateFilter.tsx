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
    <div className="date-filter">
      <div className="filter-group">
        <div className="filter-input">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="text"
            placeholder="Search titles or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-input">
          <label htmlFor="start-date">From</label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="filter-input">
          <label htmlFor="end-date">To</label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="filter-actions">
          <button onClick={handleApplyFilter} className="apply-button">
            Apply Filters
          </button>
          <button onClick={handleClearFilter} className="clear-button">
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
