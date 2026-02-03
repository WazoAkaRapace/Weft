import { useState } from 'react';
import { TranscriptSegment, Transcript } from '@weft/shared';
import { formatDuration } from '../../lib/video-stream';

interface TranscriptDisplayProps {
  transcript: Transcript;
  onSegmentClick?: (startTime: number) => void;
  currentTime?: number;
  className?: string;
}

export function TranscriptDisplay({
  transcript,
  onSegmentClick,
  currentTime,
  className = '',
}: TranscriptDisplayProps) {
  const [showTimestamps, setShowTimestamps] = useState(true);

  // Ensure segments is always an array to prevent findIndex errors
  const segments = Array.isArray(transcript.segments) ? transcript.segments : [];

  // Find current segment based on currentTime
  const currentSegmentIndex =
    currentTime !== undefined
      ? segments.findIndex(
          (seg) => currentTime >= seg.start && currentTime <= seg.end
        )
      : -1;

  const handleSegmentClick = (segment: TranscriptSegment) => {
    onSegmentClick?.(segment.start);
  };

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div className="flex justify-between items-center">
        <h3 className="text-xl text-text-default dark:text-text-dark-default">
          Transcript
        </h3>
        <button
          type="button"
          onClick={() => setShowTimestamps(!showTimestamps)}
          className="px-3 py-1.5 text-sm rounded-lg border border-border dark:border-border-dark hover:bg-background dark:hover:bg-background-dark transition-colors"
        >
          {showTimestamps ? '📄 Full Text' : '⏱️ Timestamps'}
        </button>
      </div>

      {/* Full transcript text */}
      {!showTimestamps && transcript.text && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-[12px] border-primary">
          <p className="text-text-default dark:text-text-dark-default leading-relaxed m-0">
            {transcript.text}
          </p>
        </div>
      )}

      {/* Segments with timestamps */}
      {showTimestamps && segments.length > 0 && (
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
          {segments.map((segment, index) => {
            const isActive = index === currentSegmentIndex;
            return (
              <div
                key={`${segment.start}-${segment.end}-${index}`}
                className={`flex gap-3 p-3 rounded-lg cursor-pointer transition-all border border-transparent ${
                  isActive
                    ? 'bg-primary-light dark:bg-primary/20 border-primary'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                }`}
                onClick={() => handleSegmentClick(segment)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleSegmentClick(segment);
                  }
                }}
              >
                <span className="text-xs text-primary font-semibold font-variant-numeric: tabular-nums flex-shrink-0 pt-0.5">
                  {formatDuration(segment.start)}
                </span>
                <span className="text-text-default dark:text-text-dark-default leading-relaxed flex-1">
                  {segment.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
