/**
 * IntroVideo Component
 * 
 * Full-screen video player for the mission briefing intro.
 * Features:
 * - Poster frame with tap-to-start (required for autoplay on Chromebooks)
 * - Skip button for returning users
 * - Preloads efficiently for old devices
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from './Button';

interface IntroVideoProps {
  onComplete: () => void;
  onSkip: () => void;
  showSkip?: boolean;
}

export function IntroVideo({ onComplete, onSkip, showSkip = true }: IntroVideoProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload video metadata
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onComplete();
    };

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [onComplete]);

  // Auto-hide controls during playback
  useEffect(() => {
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    } else {
      setShowControls(true);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  const handlePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to play video:', error);
      // On error, allow skip
      setIsPlaying(false);
    }
  }, []);

  const handlePause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
  }, []);

  const handleScreenTap = useCallback(() => {
    if (isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  return (
    <div 
      className="fixed inset-0 bg-black z-50 flex flex-col"
      onClick={handleScreenTap}
    >
      {/* Video element - preload metadata for efficiency on old devices */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain"
        poster="/intro-poster.jpg"
        preload="metadata"
        playsInline
        webkit-playsinline="true"
      >
        <source src="/intro.mp4" type="video/mp4" />
        Your browser does not support video playback.
      </video>

      {/* Overlay controls */}
      <div 
        className={`
          absolute inset-0 flex flex-col items-center justify-center
          transition-opacity duration-300
          ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
      >
        {/* Top bar with skip button */}
        {showSkip && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSkip();
              }}
              className="px-4 py-2 bg-black/50 hover:bg-black/70 rounded-full text-white text-sm font-medium backdrop-blur-sm transition-colors"
            >
              Skip →
            </button>
          </div>
        )}

        {/* Center play button - only show when not playing */}
        {!isPlaying && (
          <div className="flex flex-col items-center gap-6">
            {/* Title overlay on poster */}
            <div className="text-center mb-4">
              <h1 className="text-4xl md:text-5xl font-bold text-star-gold drop-shadow-lg">
                🚀 Mission Briefing
              </h1>
              <p className="text-lg text-white/80 mt-2">
                {isLoading ? 'Loading...' : 'Tap to start your adventure'}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlay();
              }}
              disabled={isLoading}
              className={`
                w-24 h-24 rounded-full flex items-center justify-center
                bg-gradient-to-br from-star-gold to-fuel-orange
                hover:from-star-gold/90 hover:to-fuel-orange/90
                active:scale-95 transition-all
                shadow-lg shadow-star-gold/30
                ${isLoading ? 'opacity-50 cursor-wait' : 'glow-gold'}
              `}
              aria-label="Play video"
            >
              <svg 
                className="w-12 h-12 text-white ml-2" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>

            {isLoading && (
              <p className="text-white/60 text-sm animate-pulse">
                Preparing mission briefing...
              </p>
            )}
          </div>
        )}

        {/* Pause button - show when playing and controls visible */}
        {isPlaying && showControls && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePause();
            }}
            className="w-16 h-16 rounded-full flex items-center justify-center bg-black/50 hover:bg-black/70 backdrop-blur-sm transition-colors"
            aria-label="Pause video"
          >
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
        <div 
          className="h-full bg-star-gold transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Bottom controls bar */}
      {showControls && isPlaying && (
        <div className="absolute bottom-4 left-4 right-4 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
          >
            Skip to Continue →
          </Button>
        </div>
      )}
    </div>
  );
}
