# Emotion Detection Feature

## Overview

The Emotion Detection feature automatically analyzes facial emotions throughout video journal entries using facial recognition technology. This provides users with insights into their emotional state during recordings, including the dominant emotion, a timeline of emotional changes, and the overall distribution of emotions detected.

## Technology Stack

- **Library:** @vladmandic/face-api (a maintained fork of face-api.js)
- **Model:** TinyFaceDetector + FaceExpressionNet
- **Runtime:** Bun.js with Node.js canvas support
- **Frame Sampling:** Every 5 seconds (configurable via `FRAME_SAMPLING_INTERVAL`)
- **Processing:** Automatic background queue

## Architecture

### Backend Components

1. **EmotionDetectionService** (`packages/server/src/services/emotionDetection.ts`)
   - Manages face-api model loading
   - Extracts frames from video using FFmpeg
   - Detects emotions from individual frames
   - Calculates dominant emotion and distribution scores
   - Saves results to database

2. **EmotionQueue** (`packages/server/src/queue/EmotionQueue.ts`)
   - In-memory job queue with worker pool
   - Configurable worker concurrency (default: 2)
   - Exponential backoff for retries
   - Graceful shutdown handling

3. **API Routes** (`packages/server/src/routes/emotions.ts`)
   - `GET /api/journals/:id/emotions` - Get emotion data
   - `POST /api/journals/:id/emotions/retry` - Re-analyze emotions

### Frontend Components

1. **EmotionBadge** - Displays dominant emotion with icon and color
2. **EmotionTimeline** - Visual timeline showing emotional changes throughout the video
3. **EmotionChart** - Pie chart showing emotion distribution
4. **EmotionDisplay** - Main container component combining all visualizations
5. **useEmotionData** - Custom hook for fetching emotion data

## Database Schema

The emotion detection feature adds three new fields to the `journals` table:

| Field | Type | Description |
|-------|------|-------------|
| `dominant_emotion` | `text` | The most prevalent emotion detected |
| `emotion_timeline` | `jsonb` | Array of timestamped emotion entries |
| `emotion_scores` | `jsonb` | Object mapping emotions to percentages |

### Emotion Labels

- **neutral** - No strong emotion detected
- **happy** - Positive emotion, joyful
- **sad** - Negative emotion, sorrowful
- **angry** - Agitated or frustrated
- **fear** - Scared or anxious
- **disgust** - Repulsed or disapproving
- **surprise** - Shocked or amazed

## API Endpoints

### GET /api/journals/:id/emotions

Get emotion detection results for a specific journal.

**Response:**
```json
{
  "data": {
    "dominantEmotion": "happy",
    "emotionTimeline": [
      { "time": 0, "emotion": "neutral", "confidence": 0.92 },
      { "time": 5, "emotion": "happy", "confidence": 0.88 },
      { "time": 10, "emotion": "happy", "confidence": 0.91 }
    ],
    "emotionScores": {
      "happy": 0.45,
      "neutral": 0.30,
      "surprise": 0.15,
      "sad": 0.10
    },
    "processingStatus": "completed"
  },
  "error": null,
  "code": "SUCCESS"
}
```

### POST /api/journals/:id/emotions/retry

Re-run emotion analysis for a journal (useful if the original analysis failed).

**Response:**
```json
{
  "data": {
    "message": "Emotion analysis queued",
    "jobId": "journalId-emotion-1234567890"
  },
  "error": null,
  "code": "SUCCESS"
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EMOTION_WORKER_CONCURRENCY` | Number of parallel emotion detection workers | `2` |
| `EMOTION_MAX_RETRIES` | Maximum retry attempts for failed jobs | `3` |
| `FACEAPI_MODELS_DIR` | Path to face-api.js model files | `/app/uploads/models/face-api` |
| `FRAME_SAMPLING_INTERVAL` | Seconds between frame samples | `5` |

### Model Setup

The emotion detection feature requires face-api.js model files. These should be placed in the directory specified by `FACEAPI_MODELS_DIR`:

Required models:
- `tiny_face_detector_model-weights_manifest.json`
- `tiny_face_detector_model-shard1`
- `face_expression_model-weights_manifest.json`
- `face_expression_model-shard1`

Download from: https://github.com/vladmandic/face-api/tree/master/model

## User Interface

### History/Timeline Page

- Emotion badges appear on journal cards showing the dominant emotion
- Hover over the badge to see the full emotion name

### Journal Detail Page

- **Emotion Analysis** section appears below video metadata
- Shows:
  - Dominant emotion badge
  - Color-coded timeline of emotional changes
  - Pie chart showing emotion distribution
  - Processing status if analysis is in progress

## Processing Flow

1. **Video Upload** → User records a journal entry
2. **Auto-Trigger** → Emotion detection job is automatically queued
3. **Frame Extraction** → FFmpeg extracts frames every 5 seconds
4. **Face Detection** → face-api detects faces in each frame
5. **Emotion Recognition** → facial expressions analyzed for emotions
6. **Aggregation** → Results compiled (dominant emotion, timeline, scores)
7. **Database Storage** → Results saved to journals table
8. **UI Update** → Frontend displays emotion visualization

## Error Handling

- **No face detected**: Frame is marked as neutral with 0 confidence
- **Low confidence**: Results below threshold (0.5) are filtered out
- **Processing failure**: Job is retried with exponential backoff (max 3 attempts)
- **Permanent failure**: Job marked as failed, error logged

## Performance Considerations

- **Frame Sampling**: Analyzing every 5 seconds balances accuracy with processing time
- **Worker Concurrency**: Default 2 workers prevent overwhelming the system
- **Model Loading**: Models loaded once at startup and cached in memory
- **FFmpeg**: Frame extraction is the most CPU-intensive operation

## Troubleshooting

### Emotion analysis not running

1. Check that face-api models are in the correct directory
2. Verify FFmpeg is available (`ffmpeg -version`)
3. Check server logs for errors
4. Ensure emotion queue is started on server startup

### No emotions detected

1. Verify the video contains visible faces
2. Check lighting conditions (poor lighting affects detection)
3. Face angle matters - frontal views work best
4. Review `MIN_CONFIDENCE` threshold in emotionDetection.ts

### High memory usage

1. Reduce `EMOTION_WORKER_CONCURRENCY`
2. Increase `FRAME_SAMPLING_INTERVAL` to sample fewer frames
3. Consider using a smaller model if available

## Future Enhancements

Possible improvements for the feature:

- **Configurable sampling interval** - Allow users to adjust accuracy vs speed
- **Per-frame confidence filtering** - Only show high-confidence detections
- **Emotion filtering** - Filter journals by emotion in history page
- **Export emotion data** - Allow users to download emotion analysis results
- **Multi-face detection** - Handle multiple people in frame
- **Temporal smoothing** - Reduce emotion flickering between frames
