# Transcription Feature

## Overview

Weft uses **OpenAI's Whisper** model (via whisper.cpp and nodejs-whisper) for automatic speech-to-text transcription of video journal entries. Transcriptions include timestamped segments for easy navigation and are stored in the database for full-text search.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TRANSCRIPTION FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Video Upload                                                         │
│     └──> User records and uploads video                                 │
│                                                                         │
│  2. Transcription Trigger                                               │
│     └──> After successful upload, transcription job is queued          │
│                                                                         │
│  3. Audio Extraction                                                    │
│     └──> FFmpeg extracts audio (16kHz, mono, PCM)                       │
│                                                                         │
│  4. Whisper Inference                                                   │
│     └──> whisper.cpp processes audio with Whisper model                 │
│                                                                         │
│  5. SRT Output Generation                                               │
│     └──> whisper.cpp writes .srt file with timestamps                   │
│                                                                         │
│  6. SRT Parsing                                                         │
│     └──> Service reads .srt file and parses segments                    │
│                                                                         │
│  7. Segment Grouping                                                    │
│     └──> Small segments grouped into sentences                          │
│                                                                         │
│  8. Database Storage                                                    │
│     └──> Transcript saved with full text and JSONB segments             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Model** | OpenAI Whisper | Speech-to-text AI model |
| **Runtime** | whisper.cpp | C++ port of Whisper for CPU inference |
| **Bindings** | nodejs-whisper | Node.js bindings for whisper.cpp |
| **Audio Processing** | FFmpeg | Audio extraction from video |
| **Database** | PostgreSQL + Drizzle ORM | Transcript and segment storage |

## Supported Models

The following Whisper models are supported, defined in `nodejs-whisper`:

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| `tiny` | ~39MB | Fastest | Lowest | Quick drafts, dev testing |
| `tiny.en` | ~39MB | Fastest | Lowest (English only) | English-only quick transcription |
| `base` | ~74MB | Fast | Medium | Balanced option |
| `base.en` | ~74MB | Fast | Medium (English only) | English-only balanced |
| `small` | ~244MB | Medium | Good | **Default recommended** |
| `small.en` | ~244MB | Medium | Good (English only) | English-only production |
| `medium` | ~769MB | Slow | Better | High accuracy needed |
| `medium.en` | ~769MB | Slow | Better (English only) | English-only high accuracy |
| `large-v1` | ~1.5GB | Very slow | Best | Maximum accuracy |
| `large` | ~1.5GB | Very slow | Best | Legacy large model |
| `large-v3-turbo` | ~1.5GB | Medium | Best | **Best quality/performance** |

### Model Selection

Users can select their preferred model in Settings. The default is `Xenova/whisper-small` (mapped to `small` in nodejs-whisper).

## Supported Languages

Whisper supports 99 languages. Users can set their preferred language in Settings, which is passed to the model via the `-l` flag.

Common languages:
- `en` - English
- `es` - Spanish
- `fr` - French
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `nl` - Dutch
- `ja` - Japanese
- `ko` - Korean
- `zh` - Chinese

Use `auto` for automatic language detection (default).

## Service Implementation

### Location

`packages/server/src/services/transcription.ts`

### Key Components

#### TranscriptionService Class

```typescript
class TranscriptionService {
  async transcribe(job: TranscriptionJob): Promise<TranscriptionResult>
  async saveTranscription(journalId: string, result: TranscriptionResult): Promise<void>
  async getTranscription(journalId: string): Promise<Transcript | null>
  async validateJournal(journalId: string): Promise<boolean>
}
```

#### Interfaces

```typescript
interface TranscriptionJob {
  journalId: string;
  userId: string;
  videoPath: string;
  retryCount?: number;
}

interface TranscriptSegment {
  start: number;        // Start time in seconds
  end: number;          // End time in seconds
  text: string;         // Segment text
  confidence?: number;  // Optional confidence score (0-1)
}

interface TranscriptionResult {
  text: string;                    // Full transcript text
  segments: TranscriptSegment[];   // Timestamped segments
}
```

### Configuration

The transcription service uses these whisper.cpp options:

```typescript
{
  outputInJson: false,    // JSON saved to file, not needed
  outputInText: false,    // Plain text not needed
  outputInSrt: true,      // SRT format for timestamp parsing
  outputInVtt: false,     // VTT format not needed
  outputInLrc: false,     // LRC format not needed
  outputInJsonFull: false, // Full JSON not needed
  wordTimestamps: false,  // Sentence-level timestamps
  splitOnWord: false,     // Don't split on individual words
}
```

### SRT Parsing

The SRT file format used by whisper.cpp:

```
[00:00:00.000 --> 00:00:02.500]   Hello world
[00:00:02.500 --> 00:00:05.000]   This is a test
```

**Important**: When `outputInSrt: true`, whisper.cpp writes the SRT file to `{videoPath}.srt` in the same directory as the input video. The service reads this file directly instead of using stdout.

### Segment Grouping

Small whisper segments are grouped into sentences using these rules:

1. **Maximum gap**: Segments within 1.0 seconds are merged
2. **Punctuation**: Segments ending with `.!?。！？` start a new sentence
3. **Capitalization**: Segments starting with capital letter start a new sentence

Example:

```
Input:  [00:00:00.0 --> 00:00:01.0] hello
        [00:00:01.1 --> 00:00:02.5] world
        [00:00:03.0 --> 00:00:05.0] how are you

Output: [00:00:00.0 --> 00:00:02.5] hello world
        [00:00:03.0 --> 00:00:05.0] how are you
```

## Database Schema

### Transcripts Table

```sql
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  segments JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX transcripts_journal_id_idx ON transcripts(journal_id);
```

### JSONB Structure

```typescript
type TranscriptSegment = {
  start: number;      // Start time in seconds
  end: number;        // End time in seconds
  text: string;       // Segment text
  confidence?: number; // Optional confidence score (0-1)
};
```

## API Endpoints

### GET `/api/journals/:journalId/transcript`

Get the transcript for a journal entry.

**Authentication**: Required

**Response** (200 OK):
```json
{
  "id": "uuid",
  "journalId": "uuid",
  "text": "Hello world. This is a test.",
  "segments": [
    {
      "start": 0.0,
      "end": 2.5,
      "text": "Hello world."
    },
    {
      "start": 3.0,
      "end": 5.0,
      "text": "This is a test."
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses**:

| Status | Code | Description |
|--------|------|-------------|
| 202 | `TRANSCRIBING` | Transcription in progress |
| 404 | `NOT_FOUND` | No transcript exists yet |
| 500 | `INTERNAL_ERROR` | Server error |

## Frontend Integration

### Transcript Display Component

Location: `packages/web/src/components/transcript/TranscriptDisplay.tsx`

```tsx
import { TranscriptDisplay } from '@/components/transcript/TranscriptDisplay';

<TranscriptDisplay
  transcript={transcript}
  onSegmentClick={(startTime) => seekTo(startTime)}
  currentTime={videoCurrentTime}
/>
```

### Features

- **Timestamp toggle**: Switch between full text and timestamped segments
- **Segment highlighting**: Current segment is highlighted based on video time
- **Click to seek**: Click on any segment to jump to that timestamp
- **Scrollable**: Long transcripts scroll independently

## Performance Considerations

### Transcription Speed

Approximate transcription times on CPU (Intel i7 / Apple M1):

| Model | 1 min audio | 10 min audio | 1 hour audio |
|-------|-------------|--------------|--------------|
| tiny | ~5s | ~30s | ~3min |
| base | ~10s | ~1min | ~6min |
| small | ~20s | ~2min | ~12min |
| medium | ~40s | ~4min | ~24min |
| large-v3-turbo | ~30s | ~3min | ~18min |

### Memory Usage

Peak memory usage during transcription:

| Model | Peak Memory |
|-------|-------------|
| tiny | ~200MB |
| base | ~300MB |
| small | ~500MB |
| medium | ~1GB |
| large-v3-turbo | ~1.5GB |

### Optimization Tips

1. **Use appropriate models**: `small` for most use cases
2. **Avoid `large-v3-turbo`** unless maximum accuracy is needed
3. **Monitor memory**: transcription can spike memory usage
4. **Process sequentially**: Don't transcribe multiple videos simultaneously

## Troubleshooting

### No Segments in Transcript

**Symptoms**: Transcript exists but `segments` array is empty or missing

**Causes**:
- SRT output was disabled (`outputInSrt: false`)
- SRT file path is incorrect
- SRT file parsing failed

**Solutions**:
1. Ensure `outputInSrt: true` in whisper options
2. Check server logs for SRT file read errors
3. Verify whisper.cpp is writing SRT file to `{videoPath}.srt`

### Missing Punctuation

**Symptoms**: Transcript has no punctuation marks

**Cause**: Whisper doesn't naturally add punctuation to speech

**Current Status**: This is a known limitation. Future improvements:
- Punctuation restoration via post-processing
- Using whisper.cpp's newer punctuation features
- Initial prompt engineering with punctuation examples

### Poor Transcription Quality

**Symptoms**: Transcribed text doesn't match audio

**Solutions**:
1. Try a larger model (e.g., `medium` or `large-v3-turbo`)
2. Ensure language setting matches audio language
3. Check audio quality (background noise, multiple speakers)
4. Verify audio sample rate is 16kHz

### Transcription Timeout

**Symptoms**: Transcription fails after long wait

**Solutions**:
1. Check if model file exists in `/app/uploads/whisper-models/`
2. Verify sufficient disk space for temporary files
3. Check Docker container memory limits
4. Use a smaller/faster model

### FFmpeg Not Found

**Symptoms**: `FFmpeg is not installed or not available in PATH`

**Solutions**:
1. Verify FFmpeg is installed in Docker image
2. Check `FFMPEG_PATH` environment variable
3. Rebuild Docker container with FFmpeg

## Development Notes

### Model Files

Whisper models are downloaded during Docker build to:
```
/app/uploads/whisper-models/
```

Model filename mapping (Xenova → nodejs-whisper):
```
Xenova/whisper-tiny       → tiny.bin
Xenova/whisper-base       → base.bin
Xenova/whisper-small      → small.bin
Xenova/whisper-medium     → medium.bin
Xenova/whisper-large      → large.bin
Xenova/whisper-large-v3   → large-v3-turbo.bin
```

### Temporary Files

During transcription:
- Input: `{videoPath}`
- SRT output: `{videoPath}.srt` (read then deleted)
- WAV audio: Created by nodejs-whisper, deleted after transcription

### Logging

Transcription service logs:
```
[Transcription] Using model: small for user {userId}
[Transcription] Using language: en for user {userId}
[Transcription] Starting transcription for journal {journalId}
[Transcription] Inference completed in {ms}ms
[Transcription] SRT file read from: {path}
[Transcription] Grouped {n} segments into {m} sentences
[Transcription] Saved transcript for journal {journalId}
```

## Future Improvements

### Known Limitations

1. **No punctuation restoration**: Transcripts lack proper punctuation
2. **No speaker diarization**: Can't distinguish multiple speakers
3. **No translation**: Only transcribes in source language
4. **No emotion in transcript**: Emotion is analyzed separately

### Planned Features

- [ ] Punctuation restoration via post-processing
- [ ] Word-level timestamps for karaoke-style display
- [ ] Translation to other languages
- [ ] Custom vocabulary/terminology boost
- [ ] Real-time streaming transcription
- [ ] Confidence scores per segment

## Additional Resources

- [Whisper Paper](https://arxiv.org/abs/2212.04356)
- [whisper.cpp GitHub](https://github.com/ggerganov/whisper.cpp)
- [nodejs-whisper npm](https://www.npmjs.com/package/nodejs-whisper)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
