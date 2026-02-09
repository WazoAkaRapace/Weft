# Mood Tracking Feature

## Overview

The Mood Tracking feature provides users with a reflective, visual interface to track and review their emotional patterns over time. It combines AI-detected emotions from video journals with manual mood logging, supporting twice-daily mood tracking (morning/afternoon) with 11 emotion options, notes, and comprehensive statistics.

### Key Features

- **Daily Mood Calendar** - Visual calendar view with color-coded mood indicators
- **Morning/Afternoon Tracking** - Track mood twice per day for more granular patterns
- **11 Emotion Options** - happy, sad, angry, neutral, sick, anxious, tired, excited, fear, disgust, surprise
- **Notes Support** - Add optional notes to each mood entry
- **Statistics Dashboard** - View mood distribution, most common mood, and logging frequency
- **Quick Dashboard Prompts** - Time-based reminders to log mood (before 12 AM, after 12 PM)
- **Journal Integration** - Calendar shows journal entries alongside mood data
- **Privacy-First** - Calm, secure interface for sensitive personal data

---

## Mood Data Model

### Time-of-Day Tracking

Each day can have up to two separate mood entries:

| Field | Type | Description |
|-------|------|-------------|
| `morningMood` | string \| null | Mood logged for morning period |
| `afternoonMood` | string \| null | Mood logged for afternoon period |
| `morningNotes` | string \| null | Optional notes for morning mood |
| `afternoonNotes` | string \| null | Optional notes for afternoon mood |

### Mood Values

The system supports 11 distinct moods:

| Mood | Emoji | Description |
|------|-------|-------------|
| `happy` | 😊 | Positive, joyful |
| `sad` | 😢 | Low mood, sorrow |
| `angry` | 😠 | Frustrated, irate |
| `neutral` | 😐 | Balanced, neither positive nor negative |
| `sick` | 🤒 | Unwell, physically ill |
| `anxious` | 😰 | Worried, nervous |
| `tired` | 😴 | Fatigued, low energy |
| `excited` | 🤩 | Enthusiastic, eager |
| `fear` | 😨 | Afraid, scared |
| `disgust` | 🤢 | Repulsed, averse |
| `surprise` | 😮 | Startled, amazed |

---

## Database Schema

### Table: `dailyMoods`

```sql
CREATE TABLE daily_moods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL, -- Format: 'YYYY-MM-DD'
  mood TEXT NOT NULL, -- One of 11 mood values
  time_of_day TEXT NOT NULL, -- 'morning' | 'afternoon'
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, date, time_of_day)
);
```

### Unique Constraint

The combination of `(userId, date, timeOfDay)` is unique, allowing:
- One morning mood per day
- One afternoon mood per day
- Both morning and afternoon moods on the same day

---

## API Endpoints

### Upsert Mood

**Endpoint:** `PUT /api/moods`

**Description:** Create or update a mood entry for a specific date and time period.

**Request Body:**
```json
{
  "date": "2026-02-08",
  "mood": "happy",
  "timeOfDay": "morning",
  "notes": "Feeling great today!"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "mood_123",
    "date": "2026-02-08",
    "mood": "happy",
    "timeOfDay": "morning",
    "notes": "Feeling great today!",
    "createdAt": "2026-02-08T10:30:00Z"
  }
}
```

### Get Moods by Date

**Endpoint:** `GET /api/moods/:date`

**Description:** Retrieve all mood entries for a specific date.

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "mood_123",
      "date": "2026-02-08",
      "mood": "happy",
      "timeOfDay": "morning",
      "notes": "Feeling great!",
      "createdAt": "2026-02-08T10:30:00Z"
    },
    {
      "id": "mood_124",
      "date": "2026-02-08",
      "mood": "tired",
      "timeOfDay": "afternoon",
      "notes": null,
      "createdAt": "2026-02-08T16:45:00Z"
    }
  ]
}
```

### Get Calendar Moods

**Endpoint:** `GET /api/moods/calendar?startDate=&endDate=`

**Description:** Retrieve mood data for a date range (typically a month).

**Query Parameters:**
- `startDate` (required): ISO date string for range start
- `endDate` (required): ISO date string for range end

**Response:** `200 OK`
```json
{
  "data": [
    {
      "date": "2026-02-08",
      "morningMood": "happy",
      "afternoonMood": "tired",
      "morningNotes": "Feeling great!",
      "afternoonNotes": null,
      "hasJournal": true,
      "journalEmotions": ["sad"]
    }
  ]
}
```

### Delete Mood

**Endpoint:** `DELETE /api/moods/:id`

**Description:** Delete a specific mood entry.

**Response:** `204 No Content`

---

## Frontend Components

### Calendar Page (`MoodCalendarPage`)

**Location:** `packages/web/src/pages/MoodCalendarPage.tsx`

**Features:**
- Monthly calendar grid with split day cells (morning/afternoon)
- Month navigation with Previous/Next buttons
- "Today" button to jump to current month
- Click either half of a day cell to log/edit mood for that time period
- Statistics panel showing:
  - Days logged count
  - With notes count
  - Journal-only days
  - Most common mood
  - Mood distribution

### Day Cell (`DayCell`)

**Location:** `packages/web/src/components/calendar/DayCell.tsx`

**Visual Design:**
- Each day cell is split vertically:
  - **Top half**: Morning mood (lighter color opacity)
  - **Bottom half**: Afternoon mood (darker color opacity)
- Each half shows the mood emoji when logged
- Hover reveals "am"/"pm" badge in top-left corner of each half
- Current day has a ring indicator
- Notes shown as amber dot in corner of each half

**Color Scheme:**

| Mood | Morning (Light) | Afternoon (Dark) |
|------|-----------------|------------------|
| Happy | `bg-yellow-200/70` | `bg-yellow-400` |
| Sad | `bg-blue-300/70` | `bg-blue-500` |
| Angry | `bg-red-300/70` | `bg-red-500` |
| Neutral | `bg-slate-200/70` | `bg-slate-300` |
| Sick | `bg-lime-200/70` | `bg-lime-400` |
| Anxious | `bg-violet-300/70` | `bg-violet-500` |
| Tired | `bg-stone-300/70` | `bg-stone-500` |
| Excited | `bg-orange-300/70` | `bg-orange-500` |
| Fear | `bg-rose-300/70` | `bg-rose-500` |
| Disgust | `bg-green-300/70` | `bg-green-500` |
| Surprise | `bg-sky-200/70` | `bg-sky-400` |

### Mood Log Dialog (`MoodLogDialog`)

**Location:** `packages/web/src/components/calendar/MoodLogDialog.tsx`

**Features:**
- Modal dialog for logging/editing mood
- Grid of 11 mood emoji buttons for selection
- Optional notes textarea (500 character limit)
- Character counter for notes field
- Save/Cancel/Update/Delete buttons
- Edit mode shows existing mood and notes
- Delete button with confirmation

### Quick Mood Dialog (`QuickMoodDialog`)

**Location:** `packages/web/src/components/feed/QuickMoodDialog.tsx`

**Features:**
- Simplified dialog for dashboard quick entry
- Same 11 mood grid
- Notes field
- Shows "Log Morning Mood" or "Log Afternoon Mood" based on time period
- No delete functionality (quick entry only)

### Mood Prompt Card (`MoodPromptCard`)

**Location:** `packages/web/src/components/feed/MoodPromptCard.tsx`

**Features:**
- Displays on dashboard when mood not yet logged for current time period
- Before 12 AM: Shows "Good morning! ☀️"
- After 12 PM: Shows "Good afternoon! 🌤️"
- Clicking opens QuickMoodDialog for that time period
- Gradient background styling (yellow to orange)

---

## Dashboard Integration

### Mood Timeline Indicators

The dashboard feed shows mood indicators next to each date header:

**Format:**
- Morning: Yellow badge with "am" label and mood emoji
- Afternoon: Orange badge with "pm" label and mood emoji

**Example:**
```
Friday, February 8
[am 😊] [pm 😴] 2 entries
```

### Mood-Only Days

Dates with mood data but no journal/note entries still appear in the feed with:
- Date header
- Mood indicators
- "No journal or note entries for this day" message

### Time-Based Prompts

Automatic prompts based on current time:
- **Before 12 PM:** Prompt for morning mood if not logged
- **After 12 PM:** Prompt for afternoon mood if not logged

---

## Color System

### Mood Colors for UI Elements

| Mood | Primary Color | Badge Background | Text Color |
|------|--------------|-----------------|-------------|
| Happy | Yellow | `bg-yellow-100 dark:bg-yellow-900/30` | `text-yellow-700 dark:text-yellow-300` |
| Sad | Blue | `bg-blue-100 dark:bg-blue-900/30` | `text-blue-700 dark:text-blue-300` |
| Angry | Red | `bg-red-100 dark:bg-red-900/30` | `text-red-700 dark:text-red-300` |
| Neutral | Slate | `bg-slate-100 dark:bg-slate-900/30` | `text-slate-700 dark:text-slate-300` |
| Sick | Lime | `bg-lime-100 dark:bg-lime-900/30` | `text-lime-700 dark:text-lime-300` |
| Anxious | Violet | `bg-violet-100 dark:bg-violet-900/30` | `text-violet-700 dark:text-violet-300` |
| Tired | Stone | `bg-stone-100 dark:bg-stone-900/30` | `text-stone-700 dark:text-stone-300` |
| Excited | Orange | `bg-orange-100 dark:bg-orange-900/30` | `text-orange-700 dark:text-orange-300` |
| Fear | Rose | `bg-rose-100 dark:bg-rose-900/30` | `text-rose-700 dark:text-rose-300` |
| Disgust | Green | `bg-green-100 dark:bg-green-900/30` | `text-green-700 dark:text-green-300` |
| Surprise | Sky | `bg-sky-100 dark:bg-sky-900/30` | `text-sky-700 dark:text-sky-300` |

---

## Testing

### Test Coverage

| Component | Test File | Test Count |
|-----------|-----------|------------|
| MoodLogDialog | `packages/web/src/components/calendar/__tests__/MoodLogDialog.test.tsx` | 43 |
| DayCell | `packages/web/src/components/calendar/__tests__/DayCell.test.tsx` | 43 |
| MoodSelector | `packages/web/src/components/moods/__tests__/MoodSelector.test.tsx` | 24 |
| moodApi | `packages/web/src/lib/__tests__/moodApi.test.ts` | 28 |

### Running Tests

```bash
# Frontend tests
pnpm --filter @weft/web test -- MoodLogDialog
pnpm --filter @weft/web test -- DayCell
pnpm --filter @weft/web test -- MoodSelector
pnpm --filter @weft/web test -- moodApi

# All mood-related tests
pnpm --filter @weft/web test
```

### Key Test Scenarios

1. **Morning/Afternoon Split** - Verify each half is clickable and independent
2. **Color Mapping** - Ensure correct colors for all 11 moods
3. **Edit Mode** - Test editing existing mood with pre-filled data
4. **Delete Confirmation** - Verify delete flow with confirmation dialog
5. **Notes Character Limit** - Test 500 character limit enforcement
6. **Keyboard Navigation** - Verify tab order and Enter key functionality
7. **Dashboard Prompts** - Test time-based prompt visibility
8. **Mood-Only Dates** - Verify dates without journals still display

---

## Integration with Journal Emotions

The mood tracker integrates seamlessly with the existing emotion detection system:

### Journal Emotions Display

When a day has journal entries but no manual mood:
- Journal emotions are shown in the calendar as indicators
- Multiple journal entries show all emotions detected
- Journal-only dates have a distinct visual treatment

### Mood Data Structure

The `CalendarMoodEntry` interface includes:
```typescript
interface CalendarMoodEntry {
  date: string;
  morningMood: string | null;
  afternoonMood: string | null;
  morningNotes: string | null;
  afternoonNotes: string | null;
  hasJournal: boolean;
  journalEmotions: string[];
}
```

### Emotion Badge Component

Existing `EmotionBadge` component is reused to display journal emotions:
```typescript
<EmotionBadge emotion={dominantEmotion} showLabel={false} />
```

---

## Migration

### Database Migration

The mood tracker feature required a new database migration to add the `dailyMoods` table with the `timeOfDay` field:

```sql
-- Migration: Add daily_moods table with time_of_day support
CREATE TABLE daily_moods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  mood TEXT NOT NULL,
  time_of_day TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, date, time_of_day)
);

CREATE INDEX idx_daily_moods_user_date ON daily_moods(user_id, date);
CREATE INDEX idx_daily_moods_date ON daily_moods(date);
```

---

## Future Enhancements

Potential improvements for the mood tracking feature:

1. **Weekly/Monthly Views** - Alternative calendar views for pattern analysis
2. **Mood Trends Chart** - Line graphs showing mood changes over time
3. **Export Data** - CSV/PDF export of mood history
4. **Correlations** - Identify patterns between mood and journal topics
5. **Reminders** - Push notifications for mood logging reminders
6. **Tagging System** - Add context tags to mood entries
7. **Streaks** - Track consecutive days of mood logging
8. **Insights** - AI-powered mood analysis and recommendations
