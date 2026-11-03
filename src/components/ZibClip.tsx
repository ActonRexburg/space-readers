/**
 * ZibClip Component
 * 
 * Comm-link popup/hologram panel for Zib story clips.
 * Features:
 * - Neon-styled holographic panel (not full screen)
 * - Shows video with poster, or plays voice-only
 * - Caption text from manifest always visible
 * - Large tap target to dismiss (48px+ "Got it" button)
 * - Auto-dismisses after clip ends
 * - Falls back to voice+poster if video won't load in 4s
 * - Position avoids story's Next button (top-right instead of bottom-right)
 * - Lazy-loads video (no preloading)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { getZibClipService, type PendingClip } from '../services/zibClips';
import { resolveAssetUrl } from '../utils/assets';

// Max time to wait for video before falling back to voice+poster
const VIDEO_LOAD_TIMEOUT_MS = 4000;

// Zib poster image for avatar
const ZIB_POSTER = resolveAssetUrl('zib-clips/poster/zib_interest_picker_intro.jpg');

interface ZibClipProps {
  position?: 'top-right' | 'center' | 'bottom-center';
}

export function ZibClip({ position = 'top-right' }: ZibClipProps) {
  const [pendingClip, setPendingClip] = useState<PendingClip | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const service = getZibClipService();
  const location = useLocation();

  // Dismiss popup on route change
  useEffect(() => {
    if (pendingClip) {
      service.skip();
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to clip changes
  useEffect(() => {
    const unsubscribe = service.subscribe((clip) => {
      setPendingClip(clip);
      setIsVideoLoaded(false);
      setIsPlaying(false);
      setVideoFailed(false);
      
      // Clear any existing timeout
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    });
    
    // Check if there's already a clip showing
    setPendingClip(service.getCurrentClip());
    
    return () => {
      unsubscribe();
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [service]);

  // Handle video loaded
  const handleVideoCanPlay = useCallback(() => {
    // Clear load timeout since video loaded
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    
    setIsVideoLoaded(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay blocked or failed - fall back to voice mode
        setVideoFailed(true);
      });
      setIsPlaying(true);
    }
  }, []);

  // Handle video error - fall back to voice mode
  const handleVideoError = useCallback(() => {
    console.warn('Zib clip video error - falling back to voice mode');
    setVideoFailed(true);
    // Clear timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  // Handle video ended
  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    // Auto-dismiss after a short delay
    setTimeout(() => {
      service.complete();
    }, 500);
  }, [service]);

  // Handle audio ended (voice-only mode)
  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    setTimeout(() => {
      service.complete();
    }, 300);
  }, [service]);

  // Handle tap to dismiss
  const handleDismiss = useCallback(() => {
    // Stop video/audio
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    service.skip();
  }, [service]);

  // Start playing when clip arrives
  useEffect(() => {
    if (!pendingClip) return;

    if (pendingClip.mode === 'voice' || videoFailed) {
      // Voice-only mode - play audio immediately
      if (audioRef.current) {
        audioRef.current.src = pendingClip.clip.voiceUrl;
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      // Video mode - explicitly load the video and set timeout
      if (videoRef.current) {
        // Set sources and load - this is critical since we use preload="metadata"
        videoRef.current.load();
      }
      
      // Set timeout to fall back to voice if video doesn't load
      loadTimeoutRef.current = setTimeout(() => {
        if (!isVideoLoaded) {
          console.warn('Zib clip video load timeout - falling back to voice');
          setVideoFailed(true);
        }
      }, VIDEO_LOAD_TIMEOUT_MS);
    }
    
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [pendingClip, videoFailed, isVideoLoaded]);

  if (!pendingClip) return null;

  const { clip, mode } = pendingClip;

  // Position classes - offset below header (≈60px) to avoid overlap with Read button
  const positionClasses = {
    'top-right': 'top-16 right-4',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'bottom-center': 'bottom-24 left-1/2 -translate-x-1/2'
  };

  // Voice-only mode OR video failed: show poster with voice
  if (mode === 'voice' || videoFailed) {
    return (
      <>
        <audio
          ref={audioRef}
          onEnded={handleAudioEnded}
          preload="none"
        />
        <div 
          className={`fixed ${positionClasses[position]} z-50`}
        >
          <div className="zib-comm-link-mini p-3 flex items-center gap-3 max-w-sm">
            {/* Zib poster image */}
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-alien-green shrink-0 glow-green">
              <img 
                src={clip.posterUrl || ZIB_POSTER} 
                alt="Zib"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Caption */}
            <div className="flex-1">
              <p className="text-sm text-white font-medium leading-snug">
                "{clip.caption}"
              </p>
            </div>
            {/* Big dismiss button - at least 48px tall for touch targets */}
            <button
              onClick={handleDismiss}
              className="shrink-0 px-5 py-3 min-w-[80px] min-h-[48px] bg-alien-green/20 hover:bg-alien-green/30 border-2 border-alien-green/60 rounded-lg text-alien-green font-bold text-lg transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      </>
    );
  }

  // Full video mode
  return (
    <div 
      className={`fixed ${positionClasses[position]} z-50`}
    >
      <div className="zib-comm-link">
        {/* Header - Zib's Comm-Link */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-neon-cyan/30">
          <div className="flex items-center gap-2">
            <span className="text-lg">📡</span>
            <span className="text-sm font-bold text-neon-cyan uppercase tracking-wider">
              Zib's Comm-Link
            </span>
          </div>
          <button 
            className="px-4 py-2 min-w-[48px] min-h-[48px] text-white/80 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
          >
            Skip ✕
          </button>
        </div>

        {/* Video container */}
        <div className="relative aspect-video bg-black/50">
          {/* Loading state */}
          {!isVideoLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <img 
                src={clip.posterUrl} 
                alt="Zib"
                className="absolute inset-0 w-full h-full object-cover opacity-50"
              />
              <div className="relative z-10 text-center">
                <div className="w-12 h-12 rounded-full border-2 border-neon-cyan border-t-transparent animate-spin mx-auto mb-2" />
                <p className="text-sm text-neon-cyan">Incoming...</p>
              </div>
            </div>
          )}
          
          {/* Video element - WebM first, MP4 fallback */}
          {/* Use preload="metadata" to start loading immediately */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${isVideoLoaded ? 'opacity-100' : 'opacity-0'}`}
            poster={clip.posterUrl}
            preload="metadata"
            playsInline
            onLoadedMetadata={() => {
              // Metadata loaded - video is accessible, clear timeout
              if (loadTimeoutRef.current) {
                clearTimeout(loadTimeoutRef.current);
                loadTimeoutRef.current = null;
              }
            }}
            onCanPlay={handleVideoCanPlay}
            onEnded={handleVideoEnded}
            onError={handleVideoError}
          >
            <source src={clip.videoUrl.replace('.mp4', '.webm')} type="video/webm" />
            <source src={clip.videoUrl} type="video/mp4" />
          </video>

          {/* Play indicator if paused */}
          {isVideoLoaded && !isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <button 
                className="w-16 h-16 rounded-full bg-neon-cyan/20 border-2 border-neon-cyan flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  videoRef.current?.play();
                  setIsPlaying(true);
                }}
              >
                <span className="text-3xl ml-1">▶</span>
              </button>
            </div>
          )}
        </div>

        {/* Caption and dismiss button */}
        <div className="px-4 py-3 bg-space-deep/80 flex items-center gap-3">
          <p className="flex-1 text-white font-medium leading-relaxed">
            "{clip.caption}"
          </p>
          <button
            onClick={handleDismiss}
            className="shrink-0 px-5 py-3 min-w-[80px] min-h-[48px] bg-alien-green/20 hover:bg-alien-green/30 border-2 border-alien-green/60 rounded-lg text-alien-green font-bold text-lg transition-colors"
          >
            Got it!
          </button>
        </div>

        {/* Scanline effect */}
        <div className="zib-scanline" />
      </div>
    </div>
  );
}

/**
 * Hook to trigger Zib clips from components
 */
export function useZibClips() {
  const service = getZibClipService();
  
  return {
    triggerInterestPickerIntro: service.triggerInterestPickerIntro.bind(service),
    triggerInterestsDone: service.triggerInterestsDone.bind(service),
    triggerWelcomeBack: service.triggerWelcomeBack.bind(service),
    triggerStoryStart: service.triggerStoryStart.bind(service),
    triggerWordCracked: service.triggerWordCracked.bind(service),
    triggerKeepTrying: service.triggerKeepTrying.bind(service),
    triggerStoryComplete: service.triggerStoryComplete.bind(service),
    triggerPlanetUnlocked: service.triggerPlanetUnlocked.bind(service),
    triggerRankUp: service.triggerRankUp.bind(service),
    isEnabled: service.isEnabled.bind(service),
    setEnabled: service.setEnabled.bind(service),
    isShowing: service.isShowing.bind(service)
  };
}
