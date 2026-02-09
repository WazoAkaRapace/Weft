# Mood Tracker Test Suite

## Overview

This test suite provides comprehensive coverage for the mood tracker feature, testing both backend API functionality and frontend component behavior.

## Test Files

### Backend Tests

#### `packages/server/tests/integration/features/mood-tracker.test.ts`

Tests manual mood CRUD operations and emotion detection integration:

- **Manual Mood Update (PUT /api/journals/:id)**
  - Set manual mood on journal entries
  - Update existing mood values
  - Clear manual mood (set to null)
  - All valid emotion values
  - Update alongside other fields
  - Timestamp updates
  - Error handling (invalid values, unauthorized, not found)

- **Mood Retrieval (GET /api/journals/:id)**
  - Journal with manual mood only
  - Journal with detected emotion only
  - Journal with both moods
  - Journal with no mood data
  - Emotion timeline and scores

- **Paginated Journals (GET /api/journals/paginated)**
  - Moods in paginated results
  - Pagination metadata
  - Date range filtering with mood data

- **Emotion Detection Integration**
  - Preserving detected emotion when manual mood is set
  - Handling journals with transcripts and mood data

- **Calendar View Data**
  - Date range queries for calendar
  - Multiple entries per day
  - Required data structure for calendar UI

#### `packages/server/tests/integration/features/mood-calendar.test.ts`

Tests calendar-specific scenarios and edge cases:

- **Calendar Mood Display Priority**
  - Manual mood overrides detected emotion
  - Fallback to detected emotion when no manual mood

- **Multiple Entries Per Day**
  - All entries returned for a day
  - Mix of manual and detected moods

- **Empty States**
  - Days with no entries
  - Entries with no mood data

- **Month Boundaries**
  - Month transitions
  - Leap years (February 29)
  - 31-day months

- **Calendar Data Structure**
  - All required fields for display
  - User isolation

### Frontend Tests

#### `packages/web/src/components/moods/__tests__/MoodSelector.test.tsx`

Tests the MoodSelector component:

- **Rendering**
  - Initial null value (Auto mode)
  - Selected mood display
  - All emotion options
  - Correct icons for each emotion

- **User Interactions**
  - Open/close dropdown
  - Select mood
  - Click outside to close
  - onChange callback
  - Auto (Detected) clears mood

- **Selected State Display**
  - Checkmark for selected mood
  - Highlight selected mood

- **Disabled State**
  - No interaction when disabled
  - Visual feedback

- **Edge Cases**
  - Rapid mood changes
  - Switching between manual and auto
  - Custom className

- **Accessibility**
  - Keyboard navigation
  - Button role
  - Focus management

- **Integration**
  - Form submission
  - Controlled component pattern

### Test Fixtures

#### `packages/server/tests/fixtures/moods.ts`

Provides test data utilities:

- `VALID_EMOTIONS` - Array of valid emotion values
- `EMOTION_ICONS` - Icon mapping for each emotion
- `createJournalWithMood()` - Create journal with mood data
- `createMoodCalendarData()` - Generate calendar test data
- `createCalendarEdgeCases()` - Create edge case scenarios
- `generateEmotionTimeline()` - Generate emotion timeline data
- `generateEmotionScores()` - Generate emotion score data

## Running Tests

### Backend Tests

```bash
# Run all mood tracker tests
pnpm --filter @weft/server test mood-tracker
pnpm --filter @weft/server test mood-calendar

# Run all integration tests
pnpm --filter @weft/server test

# Run with coverage
pnpm --filter @weft/server test:coverage
```

### Frontend Tests

```bash
# Run mood selector tests
pnpm --filter @weft/web test MoodSelector

# Run all component tests
pnpm --filter @weft/web test
```

## Test Coverage

### Backend API Coverage

- ✅ POST /api/journals - Create journal with mood
- ✅ PUT /api/journals/:id - Update manual mood
- ✅ GET /api/journals/:id - Retrieve mood data
- ✅ GET /api/journals/paginated - Calendar data with mood filters
- ✅ Authentication/authorization for all endpoints
- ✅ Error handling for edge cases

### Frontend Component Coverage

- ✅ MoodSelector rendering
- ✅ User interactions (click, select)
- ✅ State management
- ✅ Disabled state
- ✅ Accessibility features
- ✅ Integration patterns

### Edge Cases Covered

- ✅ Invalid emotion values
- ✅ Empty/null mood values
- ✅ Unauthorized access
- ✅ Non-existent resources
- ✅ Multiple entries per day
- ✅ Month boundaries and leap years
- ✅ Manual mood vs detected emotion priority
- ✅ Empty states

## Data Flow

### Setting a Manual Mood

1. User clicks mood selector
2. Selects emotion from dropdown
3. Component calls `onChange(mood)`
4. Parent component sends PUT request to `/api/journals/:id`
5. Backend updates `manualMood` field
6. Frontend displays updated mood

### Calendar Display Logic

1. Frontend requests journals for date range
2. Backend returns journals with both `manualMood` and `dominantEmotion`
3. Frontend displays mood using priority:
   - If `manualMood` exists → display it
   - Else if `dominantEmotion` exists → display it
   - Else → show empty state

## Future Test Additions

### When Calendar Component is Implemented

- Calendar rendering tests
- Month navigation tests
- Day cell rendering with mood indicators
- Click to view journal details
- Mood statistics display

### When Additional Features are Added

- Mood trends/statistics API
- Mood search/filtering
- Export mood data
- Mood insights/reports
