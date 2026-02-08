import type { Transcript } from '@weft/shared';

export const mockTranscript: Transcript = {
  text: 'Today was a great day. I went to the beach and had a wonderful time with friends.',
  segments: [
    { start: 0, end: 2.5, text: 'Today was a great day.' },
    { start: 2.5, end: 5.0, text: 'I went to the beach' },
    { start: 5.0, end: 8.5, text: 'and had a wonderful time with friends.' },
  ],
};

export const mockEmptyTranscript: Transcript = {
  text: '',
  segments: [],
};

export const mockLongTranscript: Transcript = {
  text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  segments: [
    { start: 0, end: 3, text: 'Lorem ipsum dolor sit amet,' },
    { start: 3, end: 6, text: 'consectetur adipiscing elit.' },
    { start: 6, end: 9, text: 'Sed do eiusmod tempor incididunt' },
    { start: 9, end: 12, text: 'ut labore et dolore magna aliqua.' },
    { start: 12, end: 15, text: 'Ut enim ad minim veniam,' },
    { start: 15, end: 18, text: 'quis nostrud exercitation ullamco' },
    { start: 18, end: 21, text: 'laboris nisi ut aliquip' },
    { start: 21, end: 24, text: 'ex ea commodo consequat.' },
  ],
};
