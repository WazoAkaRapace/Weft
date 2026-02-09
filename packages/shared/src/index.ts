/**
 * Shared utilities, types, and constants for the Weft application.
 */

export const APP_NAME = 'Weft';

export interface AppConfig {
  name: string;
  version: string;
}

export const config: AppConfig = {
  name: APP_NAME,
  version: '0.0.1',
};

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

/**
 * Authentication types shared between server and client
 */
export interface User {
  id: string;
  username: string | null;
  email: string | null;
  emailVerified: boolean;
  image: string | null;
  name: string | null;
  preferredLanguage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: User;
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends SignInCredentials {
  username?: string;
  name?: string;
}

/**
 * Pagination and filtering types
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface DateFilter {
  startDate?: Date;
  endDate?: Date;
}

export interface JournalListParams extends PaginationParams, DateFilter {
  search?: string;
}

/**
 * Journal entry type
 */
export interface Journal {
  id: string;
  userId: string;
  title: string;
  videoPath: string;
  thumbnailPath: string | null;
  duration: number;
  location: string | null;
  notes: string | null;
  manualMood: string | null;
  transcriptPreview: string | null;
  dominantEmotion: string | null;
  emotionTimeline: Array<{
    time: number;
    emotion: string;
    confidence: number;
  }> | null;
  emotionScores: Record<string, number> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transcript segment with timing information
 */
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

/**
 * Full transcript with segments
 */
export interface Transcript {
  id: string;
  journalId: string;
  text: string;
  segments: TranscriptSegment[];
  createdAt: Date;
}

/**
 * Journal entry with full transcript (for detail view)
 */
export interface JournalWithTranscript extends Journal {
  transcript?: Transcript;
}

/**
 * Note entry type - hierarchical notes with optional journal linking
 */
export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string | null;
  icon: string;
  color: string | null;
  parentId: string | null;
  position: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Journal-Note relationship type
 */
export interface JournalNote {
  id: string;
  noteId: string;
  journalId: string;
  createdAt: Date;
}

/**
 * Template entry type - user-specific reusable note templates
 */
export interface Template {
  id: string;
  userId: string;
  title: string;
  content: string | null;
  icon: string;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Unified feed entry type for dashboard
 */
export interface FeedEntry {
  id: string;
  type: 'note' | 'journal';
  timestamp: Date;
  title: string;
  // Note-specific
  icon?: string;
  // Journal-specific
  thumbnailPath?: string | null;
  duration?: number;
  dominantEmotion?: string | null;
  manualMood?: string | null;
}

/**
 * Mood tracking types
 */

/**
 * Valid mood values
 */
export type MoodValue = 'happy' | 'sad' | 'angry' | 'neutral' | 'sick' | 'anxious' | 'tired' | 'excited' | 'fear' | 'disgust' | 'surprise';

/**
 * Time of day for mood tracking
 */
export type TimeOfDay = 'morning' | 'afternoon';

/**
 * Daily mood entry
 */
export interface DailyMood {
  id: string;
  userId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  mood: MoodValue;
  timeOfDay: TimeOfDay;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create/update daily mood request
 */
export interface UpsertDailyMoodRequest {
  date: string; // ISO date string (YYYY-MM-DD)
  mood: MoodValue;
  timeOfDay: TimeOfDay;
  notes?: string;
}

/**
 * Daily mood response
 */
export interface DailyMoodResponse {
  data: DailyMood | null;
  error: string | null;
  code: string;
}

/**
 * Get moods for date range request
 */
export interface GetMoodsRequest {
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string; // ISO date string (YYYY-MM-DD)
}

/**
 * Mood entry with journal data for calendar view
 */
export interface CalendarMoodEntry {
  date: string; // ISO date string (YYYY-MM-DD)
  morningMood: MoodValue | null; // User-set morning mood
  afternoonMood: MoodValue | null; // User-set afternoon mood
  morningNotes: string | null; // Morning mood notes
  afternoonNotes: string | null; // Afternoon mood notes
  journalEmotions: MoodValue[]; // Emotions from journals that day
  hasJournals: boolean; // Whether there are journal entries
}

/**
 * Calendar moods response
 */
export interface CalendarMoodsResponse {
  data: CalendarMoodEntry[];
  error: string | null;
  code: string;
}

/**
 * Delete mood request/response
 */
export interface DeleteMoodResponse {
  success: boolean;
  message: string;
  error: string | null;
  code: string;
}

/**
 * Video streaming types
 */
export * from './video.js';
