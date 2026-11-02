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
 * - WebM first, MP4 fallback for codec compatibility
 * - Graceful fallback to "Continue" when video can't play
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

// Asset URLs resolved with base path (WebM first for better codec support)
const INTRO_VIDEO_WEBM = resolveAssetUrl('intro.webm');
const INTRO_VIDEO_MP4 = resolveAssetUrl('intro.mp4');
const INTRO_POSTER_URL = resolveAssetUrl('intro-poster.jpg');

// Max time to wait before offering skip (4 seconds)
const MAX_LOADING_TIME_MS = 4000;

export function IntroVideo({ onComplete, onSkip, showSkip = true }: IntroVideoProps) {
  // States: loading -> ready/unsupported -> playing -> done
  // 'unsupported' means video can't play (codec issue, etc.)
  const [loadingState, setLoadingState] = useState<'loading' | 'ready' | 'playing' | 'stalled' | 'unsupported'>('loading');
  const [bufferProgress, setBufferProgress] = useState(0);
  const [playProgress, setPlayProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [canPlayVideo, setCanPlayVideo] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Monitor loading and detect stalls/unsupported codecs
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
          stallTimeoutRef.current = null;
        }
        
        // Clear loading timeout - we're making progress
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      }
    };

    const handleCanPlay = () => {
      // Video can play - mark as ready
      if (loadingState === 'loading') {
        setLoadingState('ready');
        setCanPlayVideo(true);
      }
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current);
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };

    const handleCanPlayThrough = () => {
      setLoadingState('ready');
      setBufferProgress(100);
      setCanPlayVideo(true);
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current);
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };

    const handleWaiting = () => {
      // Video is buffering during playback - only stall if it's been a while
      if (loadingState === 'playing') {
        stallTimeoutRef.current = setTimeout(() => {
          setLoadingState('stalled');
        }, 5000);
      }
    };

    const handlePlaying = () => {
      setLoadingState('playing');
      setCanPlayVideo(true);
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current);
      }
    };

    const handleEnded = () => {
      setLoadingState('ready');
      onComplete();
    };

    const handleTimeUpdate = () => {
      if (video.duration) {
        setPlayProgress((video.currentTime / video.duration) * 100);
      }
      // If we're getting time updates, video is playing fine
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current);
        stallTimeoutRef.current = null;
      }
    };

    const handleError = () => {
      // Video error - likely codec not supported
      console.warn('Video error - codec may not be supported');
      setCanPlayVideo(false);
      setLoadingState('unsupported');
    };

    video.addEventListener('progress', handleProgress);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);

    // Start loading
    video.load();

    // Quick loading timeout - offer skip after MAX_LOADING_TIME_MS
    loadingTimeoutRef.current = setTimeout(() => {
      if (loadingState === 'loading' && bufferProgress < 20) {
        // Still loading with minimal progress - show stalled state with skip option
        setLoadingState('stalled');
      }
    }, MAX_LOADING_TIME_MS);

    return () => {
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
      
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current);
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
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
  const isUnsupported = loadingState === 'unsupported';

  return (
    <div 
      className="fixed inset-0 bg-space-dark z-50 flex flex-col overflow-hidden"
      onClick={handleScreenTap}
    >
      {/* Starfield background - always visible */}
      <Starfield />

      {/* Video element - WebM first for better codec support, MP4 fallback */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-contain z-10 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
        poster={INTRO_POSTER_URL}
        preload="auto"
        playsInline
        webkit-playsinline="true"
      >
        <source src={INTRO_VIDEO_WEBM} type="video/webm" />
        <source src={INTRO_VIDEO_MP4} type="video/mp4" />
      </video>

      {/* Loading / Ready overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6">
          
          {/* Transmission header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 mb-4">
              <span className={`w-3 h-3 rounded-full ${
                isLoading ? 'bg-star-gold animate-pulse' : 
                (isStalled || isUnsupported) ? 'bg-fuel-orange' : 
                'bg-alien-green'
              }`} />
              <span className="text-sm text-neon-cyan uppercase tracking-wider font-medium">
                {isLoading ? 'Incoming Transmission' : 
                 isUnsupported ? 'Transmission Unavailable' :
                 isStalled ? 'Signal Weak' : 
                 'Transmission Ready'}
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
                border-4 ${isReady ? 'border-alien-green glow-green' : (isStalled || isUnsupported) ? 'border-fuel-orange' : 'border-neon-cyan/50'}
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

          {/* Signal strength meter - hide for unsupported */}
          {!isUnsupported && (
            <div className="w-full max-w-xs mb-6">
              <div className="flex items-center justify-between text-xs text-neon-cyan/60 mb-2">
                <span>Signal Strength</span>
                <span>{Math.round(bufferProgress)}%</span>
              </div>
              <div className="h-4 bg-space-deep/80 rounded-full border border-neon-cyan/30 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    isStalled 
                      ? 'bg-gradient-to-r from-fuel-orange to-star-gold' 
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
                        ? isStalled ? 'bg-fuel-orange' : 'bg-alien-green' 
                        : 'bg-white/20'
                    }`}
                    style={{ height: `${12 + i * 4}px` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Loading message */}
          <p className={`text-lg text-center mb-6 h-12 transition-opacity duration-300 ${
            isLoading ? 'text-neon-cyan' : 
            isUnsupported ? 'text-fuel-orange' :
            isStalled ? 'text-fuel-orange' : 
            'text-alien-green'
          }`}>
            {isLoading && LOADING_MESSAGES[messageIndex]}
            {isReady && "✨ Transmission received! Tap to play"}
            {isStalled && "Taking a while? You can skip ahead!"}
            {isUnsupported && "Video unavailable — let's continue the mission!"}
          </p>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 items-center">
            {isReady && canPlayVideo && (
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

            {/* Unsupported codec - show friendly continue button */}
            {isUnsupported && (
              <Button
                variant="success"
                size="lg"
                glow
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip();
                }}
                className="px-8"
              >
                🚀 Continue Mission
              </Button>
            )}

            {isStalled && (
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetry();
                  }}
                >
                  🔄 Try Again
                </Button>
                <Button
                  variant="success"
                  glow
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkip();
                  }}
                >
                  Continue →
                </Button>
              </div>
            )}

            {showSkip && (isLoading || isReady) && !isUnsupported && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip();
                }}
                className="mt-4 px-6 py-3 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-base transition-colors"
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
