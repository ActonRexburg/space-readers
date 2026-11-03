/**
 * IntroVideo Component
 *
 * Full-screen video player for the mission briefing intro.
 * WebM first, MP4 fallback. Play is invoked directly from the user click.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { resolveAssetUrl } from '../utils/assets';
import { Button } from './Button';
import { Starfield } from './Starfield';
import { useIdleGlow } from '../hooks/useIdleGlow';

interface IntroVideoProps {
  onComplete: () => void;
  onSkip: () => void;
  showSkip?: boolean;
}

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

const INTRO_VIDEO_WEBM = resolveAssetUrl('intro.webm');
const INTRO_VIDEO_MP4 = resolveAssetUrl('intro.mp4');
const INTRO_POSTER_URL = resolveAssetUrl('intro-poster.jpg');

// Only show "Signal Weak" if metadata still has not arrived after ~3s
const MAX_LOADING_TIME_MS = 3000;

type LoadingState = 'loading' | 'ready' | 'playing' | 'stalled' | 'unsupported';

export function IntroVideo({ onComplete, onSkip, showSkip = true }: IntroVideoProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [bufferProgress, setBufferProgress] = useState(0);
  const [playProgress, setPlayProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [useNativeControls, setUseNativeControls] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const loadingStateRef = useRef<LoadingState>('loading');
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    loadingStateRef.current = loadingState;
  }, [loadingState]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (loadingState === 'loading' || loadingState === 'stalled') {
      const id = setInterval(() => {
        setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
      return () => clearInterval(id);
    }
  }, [loadingState]);

  // Attach listeners ONCE. Never call video.load() again after play starts —
  // re-running load() on state change was aborting playback.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setBufferProgress(prev => Math.max(prev, 50));
    };

    const handleLoadedData = () => {
      setBufferProgress(prev => Math.max(prev, 75));
    };

    const handleCanPlay = () => {
      setBufferProgress(100);
      if (loadingStateRef.current === 'loading' || loadingStateRef.current === 'stalled') {
        setLoadingState('ready');
      }
    };

    const handlePlaying = () => {
      setLoadingState('playing');
      setBufferProgress(100);
    };

    const handleEnded = () => {
      onCompleteRef.current();
    };

    const handleTimeUpdate = () => {
      if (video.duration) {
        setPlayProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleError = () => {
      console.warn('Intro video error');
      if (loadingStateRef.current !== 'playing') {
        setLoadingState('unsupported');
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);

    video.load();

    const stallTimer = setTimeout(() => {
      if (loadingStateRef.current === 'loading' && video.readyState < 2) {
        setLoadingState('stalled');
      }
    }, MAX_LOADING_TIME_MS);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
      clearTimeout(stallTimer);
    };
  }, []);

  const handlePlay = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    // Reveal the element immediately so opacity-0 cannot hide a playing video
    setLoadingState('playing');

    const tryPlay = (muted: boolean) => {
      video.muted = muted;
      setIsMuted(muted);
      const playPromise = video.play();
      if (playPromise === undefined) return;

      playPromise.catch((error: DOMException) => {
        console.error('Failed to play intro video:', error);
        if (!muted && error.name === 'NotAllowedError') {
          tryPlay(true);
          return;
        }
        // Last resort: native controls so the child can tap Play on the video itself
        setUseNativeControls(true);
        setLoadingState('playing');
      });
    };

    tryPlay(false);
  }, []);

  const handleRetry = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    setLoadingState('loading');
    setBufferProgress(0);
    setUseNativeControls(false);
    video.load();
  }, []);

  const isLoading = loadingState === 'loading';
  const isReady = loadingState === 'ready';
  const isPlaying = loadingState === 'playing';
  const isStalled = loadingState === 'stalled';
  const isUnsupported = loadingState === 'unsupported';
  // Play when ready; Continue when stalled/unsupported. Rings stay static.
  const idleGlow = useIdleGlow(!isPlaying && (isReady || isStalled || isUnsupported));

  return (
    <div className="fixed inset-0 bg-space-dark z-50 flex flex-col overflow-hidden">
      <Starfield />

      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain z-10"
        style={{ opacity: isPlaying ? 1 : 0 }}
        poster={INTRO_POSTER_URL}
        preload="auto"
        playsInline
        controls={isPlaying && useNativeControls}
      >
        <source src={INTRO_VIDEO_WEBM} type="video/webm" />
        <source src={INTRO_VIDEO_MP4} type="video/mp4" />
      </video>

      {!isPlaying && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 mb-4">
              <span className={`w-3 h-3 rounded-full ${
                isLoading ? 'bg-star-gold' :
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

          <div className="relative w-48 h-48 md:w-64 md:h-64 mb-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute w-full h-full rounded-full border-2 border-neon-cyan/20" />
              <div className="absolute w-3/4 h-3/4 rounded-full border border-neon-cyan/30" />
              <div className="absolute w-1/2 h-1/2 rounded-full border border-neon-cyan/40" />
            </div>
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

          <div className="flex flex-col gap-3 items-center">
            {(isReady || isStalled) && !isUnsupported && (
              <button
                type="button"
                onClick={handlePlay}
                className={`
                  w-20 h-20 rounded-full flex items-center justify-center
                  bg-gradient-to-br from-alien-green to-emerald-600
                  hover:from-alien-green/90 hover:to-emerald-600/90
                  active:scale-95 transition-all
                  shadow-lg shadow-alien-green/30 glow-green
                  ${isReady && !isStalled ? idleGlow : ''}
                `}
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

            {isUnsupported && (
              <Button
                variant="success"
                size="lg"
                glow
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip();
                }}
                className={`px-8 ${idleGlow}`}
              >
                🚀 Continue Mission
              </Button>
            )}

            {isStalled && (
              <div className="flex gap-3">
                <Button variant="ghost" onClick={handleRetry}>
                  🔄 Try Again
                </Button>
                <Button
                  variant="success"
                  glow
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkip();
                  }}
                  className={idleGlow}
                >
                  Continue →
                </Button>
              </div>
            )}

            {showSkip && (isLoading || isReady) && !isUnsupported && (
              <button
                type="button"
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

      {isPlaying && (
        <>
          {showSkip && (
            <div className="absolute top-4 right-4 z-30">
              <button
                type="button"
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
          {isMuted && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const video = videoRef.current;
                if (video) {
                  video.muted = false;
                  setIsMuted(false);
                }
              }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 px-6 py-3 min-h-[56px] bg-star-gold text-space-dark font-bold rounded-lg"
            >
              🔊 Unmute
            </button>
          )}
        </>
      )}

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30 pointer-events-none">
        <div
          className="h-full bg-star-gold transition-all duration-200"
          style={{ width: `${playProgress}%` }}
        />
      </div>
    </div>
  );
}
