# Emotion Detection Feature

## Overview

The Emotion Detection feature automatically analyzes emotions throughout video journal entries using **multimodal emotion recognition** combining facial and vocal cues. This provides users with insights into their emotional state during recordings, including the dominant emotion, a timeline of emotional changes, and the overall distribution of emotions detected.

## Modality Overview

The system uses two complementary emotion recognition approaches:

1. **Facial Emotion Detection** - Analyzes facial expressions from video frames
2. **Voice Emotion Detection** - Analyzes emotional tone from audio

Both modalities are processed in parallel and merged to provide a more accurate and comprehensive emotion analysis.

---

## Facial Emotion Detection

### Technology Stack

- **Library:** @vladmandic/face-api (a maintained fork of face-api.js)
- **Model:** TinyFaceDetector + FaceExpressionNet
- **Runtime:** Node.js with canvas support
- **Frame Sampling:** Every 5 seconds
- **Emotion Labels:** 7 emotions (neutral, happy, sad, angry, fear, disgust, surprise)

### Processing Flow

1. **Frame Extraction** → FFmpeg extracts frames from video every 5 seconds
2. **Face Detection** → face-api detects faces in each frame
3. **Emotion Recognition** → facial expressions analyzed for emotions
4. **Results** → Timeline of emotions with confidence scores

---

## Voice Emotion Detection

### Technology Stack

- **Library:** SpeechBrain (Python service)
- **Model:** wav2vec2-IEMOCAP (fine-tuned wav2vec2 model)
- **Runtime:** Python 3.11 + FastAPI (separate microservice)
- **Audio Sampling:** Every 5 seconds (5-second segments)
- **Audio Format:** 16kHz WAV, mono
- **Emotion Labels:** 4 core emotions (angry, happy, neutral, sad)

### Processing Flow

1. **Audio Extraction** → FFmpeg extracts audio from video
2. **Segmentation** → Audio split into 5-second segments
3. **Emotion Recognition** → SpeechBrain model analyzes each segment
4. **Results** → Timeline of emotions with confidence scores

### Service Architecture

The voice emotion detection runs as a separate Python microservice:

- **Service:** `voice-emotion-recognition`
- **API Port:** 8000
- **Health Check:** `GET /health`
- **Prediction:** `POST /predict`

---

## Multimodal Emotion Merging

### Emotion Label Mapping

Face emotions (7 labels) are mapped to voice emotions (4 labels) for merging:

| Face Emotion | Voice Emotion |
|--------------|---------------|
| happy | happy |
| sad | sad |
| angry | angry |
| neutral | neutral |
| fear → sad | Mapped to closest valence |
| surprise → happy | Mapped to closest valence |
| disgust → sad | Mapped to closest valence |

### Merging Strategy

1. **Parallel Processing** → Face and voice detection run simultaneously
2. **Timeline Merging** → At each timestamp, combine predictions from both modalities
3. **Weighted Voting** → Confidence scores determine dominant emotion at each timestamp
4. **Score Aggregation** → Final scores: 50% face + 50% voice

### Source Tracking

Each timeline entry includes source information:
- `source: ['face']` - Only facial emotion detected
- `source: ['voice']` - Only vocal emotion detected
- `source: ['face', 'voice']` - Both modalities detected

### Graceful Degradation

- If Python service is unavailable → Falls back to face-only detection
- If audio extraction fails → Falls back to face-only detection
- If both modalities fail → Job is retried

---

## Architecture

### Backend Components

1. **UnifiedEmotionDetectionService** (`packages/server/src/services/unifiedEmotionDetection.ts`)
   - Orchestrates multimodal emotion detection
   - Combines face and voice emotion results
   - Implements emotion label mapping
   - Handles graceful degradation when services are unavailable

2. **EmotionDetectionService** (`packages/server/src/services/emotionDetection.ts`)
   - Manages face-api model loading
   - Extracts frames from video using FFmpeg
   - Detects emotions from individual frames
   - Calculates dominant emotion and distribution scores

3. **VoiceEmotionDetectionService** (`packages/server/src/services/voiceEmotionDetection.ts`)
   - Integrates with Python SpeechBrain service
   - Extracts audio segments from video
   - Calls Python API for emotion prediction
   - Handles service health checks

4. **EmotionQueue** (`packages/server/src/queue/EmotionQueue.ts`)
   - In-memory job queue with worker pool
   - Configurable worker concurrency (default: 2)
   - Exponential backoff for retries
   - Graceful shutdown handling

5. **API Routes** (`packages/server/src/routes/emotions.ts`)
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

The system outputs **4 core emotions** after multimodal merging:

- **neutral** - No strong emotion detected
- **happy** - Positive emotion, joyful
- **sad** - Negative emotion, sorrowful
- **angry** - Agitated or frustrated

**Note:** Facial detection recognizes 7 emotions (including fear, disgust, surprise), but these are mapped to the 4 core emotions when combined with voice detection for consistency.

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
| **Face Emotion** | | |
| `EMOTION_WORKER_CONCURRENCY` | Number of parallel emotion detection workers | `2` |
| `EMOTION_MAX_RETRIES` | Maximum retry attempts for failed jobs | `3` |
| `FACEAPI_MODELS_DIR` | Path to face-api.js model files | `/app/uploads/models/face-api` |
| `FRAME_SAMPLING_INTERVAL` | Seconds between frame samples | `5` |
| **Voice Emotion** | | |
| `VOICE_EMOTION_API_URL` | Python SpeechBrain service URL | `http://voice-emotion-recognition:8000` |
| `AUDIO_SEGMENT_DURATION` | Seconds between audio segment samples | `5` |

### Model Setup

#### Face Models (face-api.js)

The facial emotion detection requires face-api.js model files. These should be placed in the directory specified by `FACEAPI_MODELS_DIR`:

Required models:
- `tiny_face_detector_model-weights_manifest.json`
- `tiny_face_detector_model-shard1`
- `face_expression_model-weights_manifest.json`
- `face_expression_model-shard1`

Download from: https://github.com/vladmandic/face-api/tree/master/model

#### Voice Models (SpeechBrain)

The voice emotion recognition models are **automatically downloaded** on first startup:

- Model: `speechbrain/emotion-recognition-wav2vec2-IEMOCAP`
- Download location: `/app/models` in the Python container
- Model size: ~300MB
- Startup time: ~1-2 minutes on first run (cached afterwards)

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

### Multimodal Emotion Detection Pipeline

1. **Video Upload** → User records a journal entry
2. **Auto-Trigger** → Emotion detection job is automatically queued
3. **Parallel Processing** → Both face and voice detection run simultaneously:
   - **Face Path:**
     - FFmpeg extracts frames every 5 seconds
     - face-api detects faces in each frame
     - Facial expressions analyzed for emotions
   - **Voice Path:**
     - FFmpeg extracts audio from video
     - Audio split into 5-second segments
     - SpeechBrain analyzes each segment for emotional tone
4. **Result Merging** → Face and voice predictions combined with weighted voting
5. **Aggregation** → Results compiled (dominant emotion, timeline with sources, scores)
6. **Database Storage** → Results saved to journals table
7. **UI Update** → Frontend displays emotion visualization

### Graceful Degradation

The system is designed to handle failures gracefully:

- **Python service unavailable** → Falls back to face-only detection
- **Audio extraction fails** → Falls back to face-only detection
- **Face detection fails** → Falls back to voice-only detection (if available)
- **Both modalities fail** → Job is retried with exponential backoff

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
5. Verify Python service is healthy: `curl http://localhost:8000/health`

### No emotions detected

1. Verify the video contains visible faces
2. Check lighting conditions (poor lighting affects detection)
3. Face angle matters - frontal views work best
4. Review `MIN_CONFIDENCE` threshold in emotionDetection.ts
5. Check if audio has speech content (voice detection requires speech)

### Voice emotion detection issues

**Python service not starting:**
- Check Docker logs: `docker compose logs voice-emotion-recognition`
- Verify model download is complete (may take 1-2 minutes on first run)
- Check container has sufficient memory (~2GB recommended)

**Voice emotion returns neutral only:**
- Verify audio contains speech (not just silence or music)
- Check audio quality and clarity
- Review `MIN_CONFIDENCE` threshold (currently 0.3 for voice)
- Check that audio is being extracted properly (16kHz, mono format)

**Connection errors from backend:**
- Verify `VOICE_EMOTION_API_URL` environment variable
- Check Docker network connectivity: `docker network inspect weft-network`
- Ensure Python service container is running

### High memory usage

1. Reduce `EMOTION_WORKER_CONCURRENCY`
2. Increase `FRAME_SAMPLING_INTERVAL` to sample fewer frames
3. Consider using a smaller model if available
4. Check Python service memory usage (SpeechBrain models are large)

## Future Enhancements

Possible improvements for the feature:

- **Configurable sampling interval** - Allow users to adjust accuracy vs speed
- **Per-frame confidence filtering** - Only show high-confidence detections
- **Emotion filtering** - Filter journals by emotion in history page
- **Export emotion data** - Allow users to download emotion analysis results
- **Multi-face detection** - Handle multiple people in frame
- **Temporal smoothing** - Reduce emotion flickering between frames
