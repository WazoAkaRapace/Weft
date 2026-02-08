import type { Journal, Note, Transcript, EmotionTimelineEntry, EmotionLabel } from '@weft/shared';

export const mockEmotionTimeline: EmotionTimelineEntry[] = [
  { timestamp: 0, emotion: 'neutral' as EmotionLabel, score: 0.9 },
  { timestamp: 30, emotion: 'happy' as EmotionLabel, score: 0.85 },
  { timestamp: 60, emotion: 'excited' as EmotionLabel, score: 0.8 },
  { timestamp: 90, emotion: 'happy' as EmotionLabel, score: 0.75 },
];

export const mockEmotionScores: Record<string, number> = {
  happy: 0.7,
  neutral: 0.15,
  sad: 0.05,
  excited: 0.1,
};

export const mockJournal: Journal = {
  id: 'journal-1',
  title: 'Test Journal Entry',
  videoPath: '/uploads/videos/test.mp4',
  thumbnailPath: '/uploads/thumbnails/test.jpg',
  hlsManifestPath: '/uploads/videos/test-hls/playlist.m3u8',
  duration: 120,
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-15T10:30:00Z',
  dominantEmotion: 'happy' as EmotionLabel,
  emotionTimeline: mockEmotionTimeline,
  emotionScores: mockEmotionScores,
  transcript: null,
  notes: '# Test Notes\n\nThis is a test journal entry.',
  manualMood: null,
  location: null,
  userId: 'user-1',
};

export const mockJournalWithTranscript: Journal = {
  ...mockJournal,
  transcript: {
    text: 'Today was a great day. I went to the beach and had a wonderful time with friends.',
    segments: [
      { start: 0, end: 2.5, text: 'Today was a great day.' },
      { start: 2.5, end: 5.0, text: 'I went to the beach' },
      { start: 5.0, end: 8.5, text: 'and had a wonderful time with friends.' },
    ],
  },
};

export const mockJournalList: Journal[] = [
  mockJournal,
  {
    ...mockJournal,
    id: 'journal-2',
    title: 'Second Entry',
    createdAt: '2024-01-14T15:00:00Z',
    updatedAt: '2024-01-14T15:00:00Z',
  },
  {
    ...mockJournal,
    id: 'journal-3',
    title: 'Morning Reflection',
    createdAt: '2024-01-13T08:00:00Z',
    updatedAt: '2024-01-13T08:00:00Z',
    dominantEmotion: 'calm' as EmotionLabel,
  },
];

export const mockNote: Note = {
  id: 'note-1',
  title: 'Test Note',
  content: '# Test Note Content\n\nThis is a test note.',
  icon: '📝',
  color: '#94a3b8',
  parentId: null,
  position: 0,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  userId: 'user-1',
  isTemplate: false,
};

export const mockChildNote: Note = {
  ...mockNote,
  id: 'note-2',
  title: 'Child Note',
  parentId: 'note-1',
  position: 0,
};

export const mockNoteTree = [
  {
    note: mockNote,
    children: [
      {
        note: mockChildNote,
        children: [],
      },
    ],
  },
];
