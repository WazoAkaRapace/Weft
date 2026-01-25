# Video Recording Feature

## Overview

The video recording feature allows users to create journal entries by recording videos directly in the browser, with real-time streaming to the server for efficient upload.

## Architecture

- **Frontend Hook**: `useVideoStreamer` - React hook for video recording and streaming
- **Backend API**: REST endpoints for stream initialization, upload, and journal management
- **Codec Support**: VP9 (Chrome/Firefox/Edge), H.264 (Safari)
- **Streaming**: Fetch API with ReadableStream for real-time upload

## Frontend Usage

### Basic Usage

```tsx
import { useVideoStreamer } from '@/hooks/useVideoStreamer';

function RecordJournal() {
  const {
    isRecording,
    isPaused,
    duration,
    bytesUploaded,
    error,
    streamId,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    formatDuration,
    formatBytes,
  } = useVideoStreamer();

  return (
    <div>
      <button onClick={startRecording} disabled={isRecording}>
        Start Recording
      </button>

      {isRecording && (
        <>
          <div>Duration: {formatDuration(duration)}</div>
          <div>Uploaded: {formatBytes(bytesUploaded)}</div>
          <div>Stream ID: {streamId}</div>

          {!isPaused ? (
            <button onClick={pauseRecording}>Pause</button>
          ) : (
            <button onClick={resumeRecording}>Resume</button>
          )}

          <button onClick={stopRecording}>Stop & Save</button>
          <button onClick={cancelRecording}>Cancel</button>
        </>
      )}

      {error && <div className="error">{error.message}</div>}
    </div>
  );
}
```

### Advanced Options

```tsx
const videoStreamer = useVideoStreamer({
  // Prefer specific codec
  preferredCodec: 'video/webm;codecs=vp9',

  // Chunk size for streaming (default: 64KB)
  chunkSize: 128 * 1024, // 128KB chunks

  // Duration update interval (default: 100ms)
  durationUpdateInterval: 50, // Update every 50ms

  // Progress callback
  onProgress: (bytes, duration) => {
    console.log(`Progress: ${bytes} bytes, ${duration}s`);
  },

  // State change callback
  onStateChange: (state) => {
    console.log(`State: ${state}`);
  },

  // Error callback
  onError: (error) => {
    console.error(`Error: ${error.message}`, error);
  },

  // Completion callback
  onComplete: (result) => {
    console.log(`Complete! Journal ID: ${result.journalId}`);
  },
});
```

### Hook State

| State | Type | Description |
|-------|------|-------------|
| `isRecording` | `boolean` | Currently recording |
| `isPaused` | `boolean` | Recording is paused |
| `duration` | `number` | Recording duration in seconds |
| `bytesUploaded` | `number` | Bytes streamed to server |
| `error` | `Error \| null` | Any errors that occurred |
| `streamId` | `string \| null` | Unique stream identifier |
| `recordingState` | `RecordingState` | Current recording state |
| `selectedCodec` | `VideoCodec \| null` | Selected video codec |

### Hook Methods

| Method | Description |
|--------|-------------|
| `startRecording()` | Request camera, create recorder, start stream |
| `stopRecording()` | Stop recorder, finalize stream, returns journal entry |
| `pauseRecording()` | Pause recording (keeps stream active) |
| `resumeRecording()` | Resume paused recording |
| `cancelRecording()` | Abort and cleanup without saving |

### Recording States

- `idle` - Not recording
- `recording` - Currently recording
- `paused` - Recording is paused
- `streaming` - Uploading to server
- `completed` - Upload complete
- `error` - An error occurred

## API Endpoints

### POST `/api/journals/stream/init`

Initialize a new video streaming session.

**Authentication**: Required (BetterAuth session cookie)

**Request**:
```http
POST /api/journals/stream/init
Content-Type: application/json
Cookie: session_token=...
```

**Response** (200 OK):
```json
{
  "streamId": "uuid",
  "uploadUrl": "/api/journals/stream"
}
```

**Error Response** (401 Unauthorized):
```json
{
  "error": "Unauthorized",
  "code": "PERMISSION_DENIED"
}
```

### POST `/api/journals/stream`

Upload video stream data.

**Authentication**: Required (BetterAuth session cookie)

**Headers**:
- `X-Stream-ID`: Stream identifier from init
- `Content-Type`: Video MIME type (e.g., `video/webm;codecs=vp9`)

**Request**:
```http
POST /api/journals/stream
X-Stream-ID: uuid
Content-Type: video/webm;codecs=vp9
Cookie: session_token=...

<binary video data>
```

**Response** (200 OK):
```json
{
  "streamId": "uuid",
  "journalId": "uuid",
  "videoPath": "/uploads/file.webm",
  "duration": 45
}
```

**Error Responses**:

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Missing stream ID |
| 401 | `PERMISSION_DENIED` | Invalid session |
| 404 | `INVALID_STREAM` | Stream not found or expired |
| 500 | `INTERNAL_ERROR` | Server error |

### GET `/api/journals`

Get all journals for the current user.

**Authentication**: Required

**Response** (200 OK):
```json
{
  "journals": [
    {
      "id": "uuid",
      "userId": "uuid",
      "title": "Journal Entry",
      "videoPath": "/uploads/file.webm",
      "duration": 45,
      "location": null,
      "notes": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### GET `/api/journals/:id`

Get a single journal by ID.

**Authentication**: Required

**Response** (200 OK):
```json
{
  "id": "uuid",
  "userId": "uuid",
  "title": "Journal Entry",
  "videoPath": "/uploads/file.webm",
  "duration": 45,
  "location": null,
  "notes": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### PUT `/api/journals/:id`

Update a journal.

**Authentication**: Required

**Request**:
```json
{
  "title": "Updated Title",
  "notes": "Some notes",
  "location": "San Francisco, CA"
}
```

**Response** (200 OK): Returns updated journal object

### DELETE `/api/journals/:id`

Delete a journal and its video file.

**Authentication**: Required

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Journal deleted successfully"
}
```

## Browser Compatibility

| Browser | Minimum Version | Support | Notes |
|---------|----------------|---------|-------|
| Chrome | 90+ | Full | VP9 codec recommended |
| Firefox | 88+ | Full | VP9 codec recommended |
| Safari | 14.1+ | Full | H.264 codec required |
| Edge | 90+ | Full | VP9 codec recommended |

### Browser-Specific Notes

- **Chrome/Firefox/Edge**: Default to VP9 codec (WebM container)
- **Safari**: Uses H.264 codec (MP4 container)
- **Codec detection**: Automatic fallback based on `MediaRecorder.isTypeSupported()`

## Troubleshooting

### Permission Denied

**Symptoms**: Camera permission prompt appears but is denied

**Solutions**:
1. Check browser privacy settings
2. Ensure camera/microphone permissions are granted
3. Try reloading the page and granting permissions
4. Check system-level camera permissions (macOS/Windows)

**Error Message**:
```
VideoStreamerError: Camera/microphone permission denied
Code: PERMISSION_DENIED
```

### Codec Not Supported

**Symptoms**: Recording fails with "No supported codec" error

**Solutions**:
1. Update browser to latest version
2. Check browser console for detailed codec support
3. Try a different browser

**Error Message**:
```
VideoStreamerError: Browser does not support any compatible video codecs
Code: NO_CODEC
```

### Stream Upload Fails

**Symptoms**: Recording starts but upload fails

**Solutions**:
1. Check network connection
2. Verify server is running at `http://localhost:3001`
3. Check browser console for network errors
4. Verify CORS headers are correct
5. Check server logs for errors

**Error Message**:
```
VideoStreamerError: Stream upload error: Failed to fetch
Code: NETWORK_ERROR
```

### Duration Tracking Issues

**Symptoms**: Duration doesn't update or updates incorrectly

**Solutions**:
1. Ensure tab is active (some browsers throttle inactive tabs)
2. Check for conflicting `setInterval` calls
3. Verify `durationUpdateInterval` is reasonable (default: 100ms)

### Video File Not Created

**Symptoms**: Journal entry created but no video file

**Solutions**:
1. Check `uploads/` directory exists on server
2. Verify server has write permissions
3. Check server logs for file write errors
4. Verify disk space is available

### Stream ID Invalid/Expired

**Symptoms**: Upload fails with "Invalid stream ID" error

**Solutions**:
1. Ensure stream init was called before upload
2. Stream IDs expire after 1 hour
3. Check that `X-Stream-ID` header is being sent

**Error Message**:
```json
{
  "error": "Invalid or expired stream ID",
  "code": "INVALID_STREAM"
}
```

## Development Notes

### Video Storage

Video files are stored in the `uploads/` directory relative to the server process. The directory structure:

```
uploads/
├── temp/           # Temporary files during streaming
│   └── {streamId}.tmp
└── {streamId}.webm # Final video files
```

### Codec Priority

The hook tries codecs in this order:
1. `video/webm;codecs=vp9` - Best quality, Chrome/Firefox/Edge
2. `video/webm;codecs=vp8` - Fallback for older browsers
3. `video/mp4;codecs=h264` - Safari compatibility
4. `video/webm` - Last resort

### Stream Lifecycle

1. **Init**: Client calls `/api/journals/stream/init`
2. **Stream**: Client uploads video chunks via `/api/journals/stream`
3. **Complete**: Server creates journal entry after stream ends
4. **Cleanup**: Temporary stream tracking is removed after 1 hour

### Error Codes

| Code | Description |
|------|-------------|
| `PERMISSION_DENIED` | Camera/microphone access denied |
| `NO_CODEC` | No supported video codec |
| `STREAM_ERROR` | MediaRecorder or stream error |
| `NETWORK_ERROR` | Fetch/upload error |
| `SERVER_ERROR` | Backend error |
| `VALIDATION_ERROR` | Invalid request data |
| `INVALID_STREAM` | Stream not found or expired |

## Testing

### Manual Testing Checklist

- [ ] Start recording with camera permission
- [ ] Verify duration tracking updates
- [ ] Pause and resume recording
- [ ] Stop recording and verify journal creation
- [ ] Cancel recording and verify cleanup
- [ ] Test in Chrome (VP9)
- [ ] Test in Firefox (VP9)
- [ ] Test in Safari (H.264)
- [ ] Test in Edge (VP9)
- [ ] Test permission denial
- [ ] Test network disconnection
- [ ] Test very short recordings (< 1 second)
- [ ] Test long recordings (> 5 minutes)

### Backend Testing

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test stream init (requires session cookie)
curl -X POST http://localhost:3001/api/journals/stream/init \
  -H "Content-Type: application/json" \
  --cookie "session_token=..."

# Test get journals
curl http://localhost:3001/api/journals \
  --cookie "session_token=..."
```

## Additional Resources

- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [ReadableStream API](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [BetterAuth Documentation](https://www.better-auth.com)
