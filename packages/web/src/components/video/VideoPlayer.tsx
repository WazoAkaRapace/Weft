import { useRef, useState, useEffect, useCallback } from 'react';
import { formatDuration } from '../../lib/video-stream';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface VideoPlayerProps {
  videoPath: string;
  thumbnailPath: string | null;
  duration: number;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
}

export function VideoPlayer({
  videoPath,
  thumbnailPath,
  duration,
  onTimeUpdate,
  className = '',
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);

  // Transform video path to use backend API URL
  const videoUrl = API_BASE + videoPath.replace(/^\/app/, '');
  const thumbnailUrl = thumbnailPath ? API_BASE + thumbnailPath.replace(/^\/app/, '') : undefined;

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const time = video.currentTime;
    setCurrentTime(time);
    onTimeUpdate?.(time);
  }, [onTimeUpdate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [handleTimeUpdate]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`video-player ${className}`}>
      <div className="relative w-full bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          poster={thumbnailUrl}
          className="w-full aspect-video object-contain bg-black"
          controls={false}
        />

        {/* Custom controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 hover:opacity-100 transition-opacity">
          {/* Progress bar */}
          <div className="mb-3">
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 appearance-none bg-gray-600 rounded-full cursor-pointer outline-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg"
              style={{
                background: `linear-gradient(to right, #4f46e5 ${progress}%, #374151 ${progress}%)`,
              }}
            />
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={togglePlayPause}
              className="bg-transparent border-none text-white cursor-pointer p-1 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Time display */}
            <div className="text-white text-sm font-variant-numeric: tabular-nums ml-auto">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </div>

            {/* Volume control */}
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 appearance-none bg-white/30 rounded-full cursor-pointer outline-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
