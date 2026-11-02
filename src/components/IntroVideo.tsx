/**
 * IntroVideo Component
 * 
 * Full-screen video player for the mission briefing intro.
 * Features:
 * - Engaging "incoming transmission" loading screen
 * - Signal strength meter showing real buffering progress
 * - Rotating kid-friendly loading messages
 * - Zib's silhouette while loading
 * - Skip option if loading stalls on slow Wi-Fi
 * - Poster frame with tap-to-start once ready
 * - Resolves assets via BASE_URL for GitHub Pages
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { resolveAssetUrl } from '../utils/assets';
import { Button } from './Button';
import { Starfield } from './Starfield';

interface IntroVideoProps {
  onComplete: () => void;
  onSkip: () => void;
  showSkip?: boolean;
}

// Rotating loading messages for kids
const LOADING_MESSAGES = [
  "Decoding signal from deep space...",
  "Locking onto Mars...",
  "Scanning for alien frequencies...",
  "Boosting antenna power...",
  "Connecting to the mothership...",
  "Receiving transmission...",
  "Almost there, Cadet!",
  "Signal getting stronger..."
];

// Asset URLs resolved with base path
const INTRO_VIDEO_URL = resolveAssetUrl('intro.mp4');
const INTRO_POSTER_URL = resolveAssetUrl('intro-poster.jpg');

export function IntroVideo({ onComplete, onSkip, showSkip = true }: IntroVideoProps) {
  const [loadingState, setLoadingState] = useState<'loading' | 'ready' | 'playing' | 'stalled'>('loading');
  const [bufferProgress, setBufferProgress] = useState(0);
  const [playProgress, setPlayProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rotate loading messages
  useEffect(() => {
    if (loadingState === 'loading' || loadingState === 'stalled') {
      messageIntervalRef.current = setInterval(() => {
        setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
    }
    
    return () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
    };
  }, [loadingState]);

  // Monitor loading and detect stalls
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleProgress = () => {
      // Calculate buffer progress
      if (video.buffered.length > 0 && video.duration) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const progress = (bufferedEnd / video.duration) * 100;
        setBufferProgress(progress);
        
        // Clear stall timeout on progress
        if (stallTimeoutRef.current) {
          clearTimeout(stallTimeoutRef.current);
        }
        
        // Set new stall timeout (15 seconds without progress = stalled)
        stallTimeoutRef.current = setTimeout(() => {
          if (loadingState === 'loading') {
            setLoadingState('stalled');
          }
        }, 15000);
      }
    };

    const handleCanPlayThrough = () => {
      setLoadingState('ready');
      setBufferProgress(100);
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current);
      }
    };

    const handleWaiting = () => {
      // Video is buffering during playback
      if (loadingState === 'playing') {
        setLoadingState('stalled');
      }
    };

    const handlePlaying = () => {
      setLoadingState('playing');
    };

    const handleEnded = () => {
      setLoadingState('ready');
      onComplete();
    };

    const handleTimeUpdate = () => {
      if (video.duration) {
        setPlayProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleError = () => {
      setLoadingState('stalled');
    };

    video.addEventListener('progress', handleProgress);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);

    // Start loading
    video.load();

    // Initial stall timeout
    stallTimeoutRef.current = setTimeout(() => {
      if (loadingState === 'loading' && bufferProgress < 10) {
        setLoadingState('stalled');
      }
    }, 10000);

    return () => {
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
      
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current);
      }
    };
  }, [onComplete, loadingState, bufferProgress]);

  // Auto-hide controls during playback
  useEffect(() => {
    if (loadingState === 'playing') {
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
  }, [loadingState]);

  const handlePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setLoadingState('playing');
    } catch (error) {
      console.error('Failed to play video:', error);
      setLoadingState('stalled');
    }
  }, []);

  const handlePause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setLoadingState('ready');
  }, []);

  const handleRetry = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    setLoadingState('loading');
    setBufferProgress(0);
    video.load();
  }, []);

  const handleScreenTap = useCallback(() => {
    if (loadingState === 'playing') {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (loadingState === 'playing') setShowControls(false);
      }, 3000);
    }
  }, [loadingState]);

  const isLoading = loadingState === 'loading';
  const isReady = loadingState === 'ready';
  const isPlaying = loadingState === 'playing';
  const isStalled = loadingState === 'stalled';

  return (
    <div 
      className="fixed inset-0 bg-space-dark z-50 flex flex-col overflow-hidden"
      onClick={handleScreenTap}
    >
      {/* Starfield background - always visible */}
      <Starfield />

      {/* Hidden video element */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-contain z-10 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
        poster={INTRO_POSTER_URL}
        preload="auto"
        playsInline
        webkit-playsinline="true"
      >
        <source src={INTRO_VIDEO_URL} type="video/mp4" />
        Your browser does not support video playback.
      </video>

      {/* Loading / Ready overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6">
          
          {/* Transmission header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 mb-4">
              <span className={`w-3 h-3 rounded-full ${isLoading ? 'bg-star-gold animate-pulse' : isStalled ? 'bg-red-500' : 'bg-alien-green'}`} />
              <span className="text-sm text-neon-cyan uppercase tracking-wider font-medium">
                {isLoading ? 'Incoming Transmission' : isStalled ? 'Signal Lost' : 'Transmission Ready'}
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-star-gold text-glow-gold">
              🚀 Mission Briefing
            </h1>
          </div>

          {/* Zib silhouette / radar scan */}
          <div className="relative w-48 h-48 md:w-64 md:h-64 mb-8">
            {/* Radar rings */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`absolute w-full h-full rounded-full border-2 border-neon-cyan/20 ${isLoading ? 'animate-ping' : ''}`} style={{ animationDuration: '3s' }} />
              <div className={`absolute w-3/4 h-3/4 rounded-full border border-neon-cyan/30 ${isLoading ? 'animate-ping' : ''}`} style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
              <div className={`absolute w-1/2 h-1/2 rounded-full border border-neon-cyan/40 ${isLoading ? 'animate-ping' : ''}`} style={{ animationDuration: '2s', animationDelay: '1s' }} />
            </div>
            
            {/* Zib poster/silhouette in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`
                w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden
                border-4 ${isReady ? 'border-alien-green glow-green' : isStalled ? 'border-red-500' : 'border-neon-cyan/50'}
                bg-space-deep
                transition-all duration-500
              `}>
                <img 
                  src={INTRO_POSTER_URL} 
                  alt="Zib"
                  className={`w-full h-full object-cover ${isLoading ? 'opacity-50 blur-sm' : 'opacity-100 blur-0'} transition-all duration-500`}
                />
              </div>
            </div>
          </div>

          {/* Signal strength meter */}
          <div className="w-full max-w-xs mb-6">
            <div className="flex items-center justify-between text-xs text-neon-cyan/60 mb-2">
              <span>Signal Strength</span>
              <span>{Math.round(bufferProgress)}%</span>
            </div>
            <div className="h-4 bg-space-deep/80 rounded-full border border-neon-cyan/30 overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  isStalled 
                    ? 'bg-gradient-to-r from-red-600 to-red-500' 
                    : bufferProgress >= 100 
                      ? 'bg-gradient-to-r from-alien-green to-emerald-400 glow-green' 
                      : 'bg-gradient-to-r from-star-gold to-fuel-orange'
                }`}
                style={{ width: `${bufferProgress}%` }}
              />
            </div>
            
            {/* Signal bars */}
            <div className="flex justify-center gap-1 mt-3">
              {[0, 20, 40, 60, 80].map((threshold, i) => (
                <div 
                  key={i}
                  className={`w-3 transition-all duration-300 ${
                    bufferProgress > threshold 
                      ? isStalled ? 'bg-red-500' : 'bg-alien-green' 
                      : 'bg-white/20'
                  }`}
                  style={{ height: `${12 + i * 4}px` }}
                />
              ))}
            </div>
          </div>

          {/* Loading message */}
          <p className={`text-lg text-center mb-6 h-8 transition-opacity duration-300 ${isLoading ? 'text-neon-cyan' : isStalled ? 'text-red-400' : 'text-alien-green'}`}>
            {isLoading && LOADING_MESSAGES[messageIndex]}
            {isReady && "✨ Transmission received! Tap to play"}
            {isStalled && "Signal interrupted. Slow connection?"}
          </p>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 items-center">
            {isReady && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlay();
                }}
                className="
                  w-20 h-20 rounded-full flex items-center justify-center
                  bg-gradient-to-br from-alien-green to-emerald-600
                  hover:from-alien-green/90 hover:to-emerald-600/90
                  active:scale-95 transition-all
                  shadow-lg shadow-alien-green/30 glow-green
                "
                aria-label="Play video"
              >
                <svg 
                  className="w-10 h-10 text-white ml-1" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            )}

            {isStalled && (
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetry();
                  }}
                >
                  🔄 Try Again
                </Button>
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkip();
                  }}
                >
                  Skip for Now →
                </Button>
              </div>
            )}

            {showSkip && (isLoading || isReady) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip();
                }}
                className="mt-4 px-4 py-2 text-white/60 hover:text-white text-sm transition-colors"
              >
                Skip intro →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Playing overlay controls */}
      {isPlaying && showControls && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/20">
          {/* Skip button top right */}
          {showSkip && (
            <div className="absolute top-4 right-4">
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

          {/* Center pause button */}
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
        </div>
      )}

      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
        <div 
          className="h-full bg-star-gold transition-all duration-200"
          style={{ width: `${playProgress}%` }}
        />
      </div>
    </div>
  );
}
