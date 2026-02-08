import { vi } from 'vitest';

// Mock MediaRecorder API
export const createMockMediaStream = () => ({
  getVideoTracks: vi.fn(() => [{ stop: vi.fn(), kind: 'video' }]),
  getAudioTracks: vi.fn(() => [{ stop: vi.fn(), kind: 'audio' }]),
  getTracks: vi.fn(() => []),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  active: true,
  id: 'mock-stream-id',
  onaddtrack: null,
  onremovetrack: null,
});

const mockMediaRecorder = vi.fn().mockImplementation(() => {
  const instance = {
    start: vi.fn(function(this: any) {
      this.state = 'recording';
    }),
    stop: vi.fn(function(this: any) {
      this.state = 'inactive';
      // Simulate ondataavailable and onstop callbacks
      if (this.ondataavailable) {
        this.ondataavailable({ data: new Blob(['mock video data'], { type: 'video/webm' }) });
      }
      if (this.onstop) {
        this.onstop();
      }
    }),
    pause: vi.fn(function(this: any) {
      this.state = 'paused';
    }),
    resume: vi.fn(function(this: any) {
      this.state = 'recording';
    }),
    ondataavailable: null,
    onstop: null,
    onerror: null,
    state: 'inactive',
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 2500000,
  };

  return instance;
});

// Assign MediaRecorder to global
Object.defineProperty(global, 'MediaRecorder', {
  value: mockMediaRecorder,
  writable: true,
});

Object.defineProperty(MediaRecorder, 'isTypeSupported', {
  value: vi.fn((mimeType: string) => {
    return mimeType.startsWith('video/webm') || mimeType.startsWith('video/mp4');
  }),
  writable: true,
});

Object.defineProperty(MediaRecorder, 'quit', {
  value: vi.fn(),
  writable: true,
});

// Mock getUserMedia
const mockGetUserMedia = vi.fn().mockResolvedValue(createMockMediaStream());

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: vi.fn().mockResolvedValue([]),
    getSupportedConstraints: vi.fn().mockReturnValue({}),
    getDisplayMedia: vi.fn(),
  },
  writable: true,
  configurable: true,
});

// Ensure navigator exists
if (!global.navigator) {
  (global as any).navigator = {};
}

// Mock HLS.js
const mockHlsInstance = {
  loadSource: vi.fn(),
  attachMedia: vi.fn(),
  detachMedia: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  destroy: vi.fn(),
  levels: [{ height: 720, bitrate: 1000000 }, { height: 1080, bitrate: 2000000 }],
  currentLevel: 0,
  autoLevelEnabled: true,
  config: {},
  recoverMediaError: vi.fn(),
  startLoad: vi.fn(),
  stopLoad: vi.fn(),
};

vi.mock('hls.js', () => ({
  default: vi.fn(() => mockHlsInstance),
  isSupported: vi.fn(() => true),
  Events: {
    MANIFEST_PARSED: 'manifestParsed',
    LEVEL_SWITCHED: 'levelSwitched',
    ERROR: 'error',
    FRAG_LOADED: 'fragLoaded',
    FRAG_PARSING_INIT_SEGMENT: 'fragParsingInitSegment',
  },
  ErrorTypes: {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError',
    KEY_ERROR: 'keyError',
    OTHER_ERROR: 'otherError',
  },
  ErrorDetails: {
    MANIFEST_LOAD_ERROR: 'manifestLoadError',
    MANIFEST_LOAD_TIMEOUT: 'manifestLoadTimeout',
    MANIFEST_PARSING_ERROR: 'manifestParsingError',
    LEVEL_LOAD_ERROR: 'levelLoadError',
    LEVEL_LOAD_TIMEOUT: 'levelLoadTimeout',
    FRAG_LOAD_ERROR: 'fragLoadError',
    FRAG_LOAD_TIMEOUT: 'fragLoadTimeout',
  },
}));

// Export for use in tests
export { mockHlsInstance };

// Mock EventSource for job status
export const createMockEventSource = vi.fn().mockImplementation(() => {
  const mockEventListeners = new Map<string, EventListener>();

  return {
    addEventListener: vi.fn((event: string, listener: EventListener) => {
      mockEventListeners.set(event, listener);
    }),
    removeEventListener: vi.fn((event: string, listener: EventListener) => {
      mockEventListeners.delete(event);
    }),
    close: vi.fn(),
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2,
    url: '',
    // Helper to simulate events
    _simulateEvent: (event: string, data: any) => {
      const listener = mockEventListeners.get(event);
      if (listener) {
        listener(new MessageEvent('message', { data: JSON.stringify(data) }));
      }
    },
  };
});

Object.defineProperty(global, 'EventSource', {
  value: createMockEventSource(),
  writable: true,
  configurable: true,
});

// Export for testing
export const mockEventSource = createMockEventSource();

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock File and Blob
global.File = class File extends Blob {
  name: string;
  lastModified: number;

  constructor(bits: any[], name: string, options?: BlobPropertyBag) {
    super(bits, options);
    this.name = name;
    this.lastModified = Date.now();
  }
} as any;

// Export utilities for tests
export const mockBrowserApis = {
  resetAll: () => {
    mockGetUserMedia.mockReset();
    mockMediaRecorder.mockReset();
  },

  // Helper to simulate successful getUserMedia
  mockSuccessfulGetUserMedia: () => {
    mockGetUserMedia.mockResolvedValueOnce(createMockMediaStream());
  },

  // Helper to simulate failed getUserMedia (permission denied)
  mockFailedGetUserMedia: (errorName = 'NotAllowedError') => {
    const error = new Error('Permission denied');
    (error as any).name = errorName;
    mockGetUserMedia.mockRejectedValueOnce(error);
  },

  // Helper to simulate no codec support
  mockNoCodecSupport: () => {
    (MediaRecorder.isTypeSupported as jest.Mock).mockReturnValue(false);
  },

  // Helper to reset codec support
  mockCodecSupport: () => {
    (MediaRecorder.isTypeSupported as jest.Mock).mockReturnValue(true);
  },
};

// HLS.js mock helpers
export const mockHlsJs = {
  mockSupported: () => {
    const Hls = require('hls.js').default;
    Hls.isSupported.mockReturnValue(true);
  },

  mockNotSupported: () => {
    const Hls = require('hls.js').default;
    Hls.isSupported.mockReturnValue(false);
  },

  getInstance: () => {
    return mockHlsInstance;
  },
};

export { mockGetUserMedia, mockMediaRecorder };
