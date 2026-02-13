import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { formatDuration } from '../../lib/video-stream';
import Hls from 'hls.js';
import { getApiUrl } from '../../lib/config';

interface VideoPlayerProps {
  videoPath: string;
  thumbnailPath: string | null;
  duration: number;
  onTimeUpdate?: (currentTime: number) => void;
  seekTo?: number; // External time to seek to
  className?: string;
  hlsManifestPath?: string | null; // HLS manifest path if available
}

export function VideoPlayer({
  videoPath,
  thumbnailPath,
  duration,
  onTimeUpdate,
  seekTo,
  className = '',
  hlsManifestPath,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const isSeekingRef = useRef(false); // Track if user is currently seeking
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Transform video path to use backend API URL (memoized to prevent reloads)
  const videoUrl = useMemo(() => getApiUrl() + videoPath.replace(/^\/app/, ''), [videoPath]);
  const thumbnailUrl = useMemo(
    () => (thumbnailPath ? getApiUrl() + thumbnailPath.replace(/^\/app/, '') : undefined),
    [thumbnailPath]
  );

  // Determine the HLS manifest URL
  const hlsManifestUrl = useMemo(() => {
    if (hlsManifestPath) {
      return getApiUrl() + hlsManifestPath.replace(/^\/app/, '');
    }
    return null;
  }, [hlsManifestPath]);

  // Detect if video should use HLS (has HLS manifest path or videoPath is HLS)
  const isHLS = useMemo(() => {
    return !!hlsManifestUrl || videoPath.endsWith('.m3u8') || videoPath.includes('-hls/');
  }, [hlsManifestUrl, videoPath]);

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
    isSeekingRef.current = true;
    video.currentTime = newTime;
    setCurrentTime(newTime);

    // Reset seeking flag after a short delay
    setTimeout(() => {
      isSeekingRef.current = false;
    }, 100);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error('Failed to enter fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    // Don't update state while user is seeking (avoid conflicts)
    if (isSeekingRef.current) return;

    const video = videoRef.current;
    if (!video) return;

    const time = video.currentTime;
    setCurrentTime(time);
    onTimeUpdate?.(time);
  }, [onTimeUpdate]);

  // HLS.js initialization
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Clean up any existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHLS) {
      if (Hls.isSupported()) {
        // HLS.js is supported
        console.log('[VideoPlayer] Initializing HLS.js');

        const hls = new Hls({
          // Configuration for long videos
          maxBufferLength: 30, // Maximum buffer length in seconds
          maxMaxBufferLength: 60, // Maximum buffer length for long videos
          maxBufferSize: 60 * 1000 * 1000, // 60 MB
          maxBufferHole: 0.5, // Maximum buffer hole in seconds
          // Enable quality switching
          abrEwmaFastLive: 3,
          abrEwmaSlowLive: 10,
          abrEwmaFastVoD: 3,
          abrEwmaSlowVoD: 10,
          abrMaxWithRealBitrate: true,
          // Error recovery
          maxLoadingDelay: 8,
          maxStarvationDelay: 4,
        });

        hlsRef.current = hls;

        // Use HLS manifest URL if available, otherwise fall back to video URL
        const sourceUrl = hlsManifestUrl || videoUrl;
        hls.loadSource(sourceUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          console.log('[VideoPlayer] HLS Manifest loaded, quality levels:', data.levels.length);
          // Auto-play if already playing
          if (isPlaying) {
            video.play().catch(console.error);
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          console.log('[VideoPlayer] HLS Level switched:', data.level, hls.levels[data.level]?.height);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.error('[VideoPlayer] HLS Error:', data.type, data.details, data.fatal);

          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('[VideoPlayer] Fatal network error, trying to recover...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('[VideoPlayer] Fatal media error, trying to recover...');
                hls.recoverMediaError();
                break;
              default:
                console.error('[VideoPlayer] Fatal error, cannot recover');
                hls.destroy();
                break;
            }
          }
        });

        return () => {
          hls.destroy();
          hlsRef.current = null;
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        console.log('[VideoPlayer] Using native HLS support');
        video.src = videoUrl;
      } else {
        console.warn('[VideoPlayer] HLS not supported, fallback to direct playback');
        video.src = videoUrl;
      }
    } else {
      // Direct video playback (non-HLS)
      video.src = videoUrl;
    }
    // Note: isPlaying is intentionally not in deps to avoid re-init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, isHLS, hlsManifestUrl]);

  // Video event listeners
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

  // Handle fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle external seek requests (e.g., from transcript clicks)
  // Only update the video element - let timeupdate event update the React state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || seekTo === undefined) return;

    // Only seek if the time is significantly different (avoid infinite loops)
    if (Math.abs(video.currentTime - seekTo) > 0.5) {
      isSeekingRef.current = true;
      video.currentTime = seekTo;
      // Note: We don't call setCurrentTime here to avoid cascading renders
      // The timeupdate event will update the state via handleTimeUpdate

      // Reset seeking flag after a short delay
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 200);
    }
  }, [seekTo]);

  // Cleanup HLS instance on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`video-player ${className}`}>
      <div ref={containerRef} className="relative w-full bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          poster={thumbnailUrl}
          className="w-full aspect-video object-contain bg-black"
          controls={false}
          // Don't set src here - it's set by HLS.js or in the useEffect
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

            {/* Fullscreen button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="bg-transparent border-none text-white cursor-pointer p-1 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
