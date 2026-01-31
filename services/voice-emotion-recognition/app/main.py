"""
Voice Emotion Recognition Service
FastAPI service for SpeechBrain-based emotion detection from audio
"""
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import torch
import torchaudio
import logging
import io
from typing import Dict
import os
import tempfile
import soundfile as sf
import numpy as np

from .config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Voice Emotion Recognition API",
    description="SpeechBrain-based emotion detection from audio",
    version="1.0.0"
)

# Global model variable
classifier = None

# Emotion labels for SpeechBrain IEMOCAP model
EMOTION_LABELS = ["angry", "happy", "neutral", "sad"]


@app.on_event("startup")
async def load_model():
    """Load SpeechBrain model on startup"""
    global classifier
    try:
        logger.info("Loading SpeechBrain emotion recognition model...")

        # Ensure model cache directory exists
        os.makedirs(settings.model_cache_dir, exist_ok=True)

        # Use SpeechBrain foreign_class interface for wav2vec2 model
        from speechbrain.inference.interfaces import foreign_class

        # The wav2vec2 model uses a custom interface
        classifier = foreign_class(
            source="speechbrain/emotion-recognition-wav2vec2-IEMOCAP",
            pymodule_file="custom_interface.py",
            classname="CustomEncoderWav2vec2Classifier",
            savedir=str(settings.model_cache_dir)
        )
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        # Don't raise - allow service to start for health checks
        classifier = None


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": classifier is not None,
        "service": "voice-emotion-recognition"
    }


@app.post("/predict")
async def predict_emotion(audio_file: UploadFile = File(...)):
    """
    Predict emotion from audio file using SpeechBrain wav2vec2 model

    Requirements:
    - Format: WAV
    - Sample rate: 16kHz (will be resampled if needed)
    - Channels: Mono (will be converted if stereo)

    Returns:
        JSON with emotion prediction including:
        - emotion: dominant emotion label
        - confidence: confidence score (0-1)
        - scores: dictionary of all emotion scores
    """
    if classifier is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Service is initializing or failed to load model."
        )

    try:
        # Read uploaded file
        contents = await audio_file.read()

        # Save to temporary file for classify_file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_file.write(contents)
            temp_path = temp_file.name

        try:
            # The wav2vec2 custom classifier uses classify_file which handles
            # resampling and preprocessing internally
            out_prob, score, index, text_lab = classifier.classify_file(temp_path)

            # text_lab may be a tensor or string - extract the emotion label
            # SpeechBrain returns various formats, handle all cases
            if hasattr(text_lab, 'item'):
                emotion_raw = text_lab.item()
            elif isinstance(text_lab, (list, tuple)):
                emotion_raw = str(text_lab[0]) if len(text_lab) > 0 else 'neutral'
            else:
                emotion_raw = str(text_lab)

            # Clean up the emotion label - it might be wrapped in brackets or quotes
            emotion_raw = emotion_raw.strip().strip("[]'\"")

            # Map 3-letter codes to full emotion names
            emotion_mapping = {
                'hap': 'happy',
                'sad': 'sad',
                'ang': 'angry',
                'neu': 'neutral',
                'exc': 'happy',  # excited -> happy
                'fru': 'sad',   # frustrated -> sad
                'fea': 'sad',   # fearful -> sad
                'sur': 'happy',  # surprised -> happy
                'xxx': 'neutral', # unknown -> neutral
            }

            # First try direct mapping, then 3-letter codes
            if emotion_raw in EMOTION_LABELS:
                emotion = emotion_raw
            else:
                emotion = emotion_mapping.get(emotion_raw.lower(), emotion_raw)

            # Ensure emotion is valid
            if emotion not in EMOTION_LABELS:
                emotion = 'neutral'

            # Get confidence from score
            if hasattr(score, 'item'):
                confidence = float(score.item())
            else:
                confidence = float(score)

            # Extract scores from out_prob
            if hasattr(out_prob, 'numpy'):
                scores_array = out_prob.numpy().squeeze()
            elif isinstance(out_prob, torch.Tensor):
                scores_array = out_prob.squeeze().numpy()
            else:
                # Fallback: create uniform scores
                scores_array = np.array([0.25] * len(EMOTION_LABELS))

            # Create response with all emotion scores
            emotion_scores: Dict[str, float] = {}
            for i, label in enumerate(EMOTION_LABELS):
                if i < len(scores_array):
                    emotion_scores[label] = float(scores_array[i])
                else:
                    emotion_scores[label] = 0.0

            logger.info(f"Prediction complete: {emotion} (confidence: {confidence:.3f})")

            return {
                "emotion": emotion,
                "confidence": confidence,
                "scores": emotion_scores
            }
        finally:
            # Clean up temporary file
            os.unlink(temp_path)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Voice Emotion Recognition API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "predict": "/predict"
        },
        "model_loaded": classifier is not None
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
