/**
 * ZibClip Component
 * 
 * Comm-link popup/hologram panel for Zib story clips.
 * Features:
 * - Neon-styled holographic panel (not full screen)
 * - Shows video with poster, or plays voice-only
 * - Caption text from manifest always visible
 * - Tap to dismiss/skip
 * - Lazy-loads video (no preloading)
 * - Doesn't block reading flow for long
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { getZibClipService, type PendingClip } from '../services/zibClips';

interface ZibClipProps {
  position?: 'bottom-right' | 'center' | 'bottom-center';
}

export function ZibClip({ position = 'bottom-right' }: ZibClipProps) {
  const [pendingClip, setPendingClip] = useState<PendingClip | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const service = getZibClipService();

  // Subscribe to clip changes
  useEffect(() => {
    const unsubscribe = service.subscribe((clip) => {
      setPendingClip(clip);
      setIsVideoLoaded(false);
      setIsPlaying(false);
    });
    
    // Check if there's already a clip showing
    setPendingClip(service.getCurrentClip());
    
    return unsubscribe;
  }, [service]);

  // Handle video loaded
  const handleVideoCanPlay = useCallback(() => {
    setIsVideoLoaded(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay blocked - user needs to tap
      });
      setIsPlaying(true);
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

    if (pendingClip.mode === 'voice') {
      // Voice-only mode - play audio immediately
      if (audioRef.current) {
        audioRef.current.src = pendingClip.clip.voiceUrl;
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
    // Video mode is handled by the video element's onCanPlay
  }, [pendingClip]);

  if (!pendingClip) return null;

  const { clip, mode } = pendingClip;

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2'
  };

  // Voice-only mode: smaller, simpler display
  if (mode === 'voice') {
    return (
      <>
        <audio
          ref={audioRef}
          onEnded={handleAudioEnded}
          preload="none"
        />
        <div 
          className={`fixed ${positionClasses[position]} z-50 cursor-pointer`}
          onClick={handleDismiss}
        >
          <div className="zib-comm-link-mini p-3 flex items-center gap-3 max-w-xs">
            {/* Small Zib avatar */}
            <div className="w-12 h-12 rounded-full bg-alien-green/20 border-2 border-alien-green flex items-center justify-center text-2xl shrink-0 pulse-glow">
              👽
            </div>
            {/* Caption */}
            <div className="flex-1">
              <p className="text-sm text-white font-medium leading-snug">
                "{clip.caption}"
              </p>
              <p className="text-xs text-neon-cyan/60 mt-1">Tap to dismiss</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Full video mode
  return (
    <div 
      className={`fixed ${positionClasses[position]} z-50`}
      onClick={handleDismiss}
    >
      <div className="zib-comm-link cursor-pointer">
        {/* Header - Zib's Comm-Link */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-neon-cyan/30">
          <div className="flex items-center gap-2">
            <span className="text-lg">📡</span>
            <span className="text-sm font-bold text-neon-cyan uppercase tracking-wider">
              Zib's Comm-Link
            </span>
          </div>
          <button 
            className="text-white/60 hover:text-white text-sm px-2 py-1"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
          >
            ✕ Skip
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
                <div className="text-4xl animate-pulse mb-2">👽</div>
                <p className="text-sm text-neon-cyan">Loading transmission...</p>
              </div>
            </div>
          )}
          
          {/* Video element - lazy loaded */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${isVideoLoaded ? 'opacity-100' : 'opacity-0'}`}
            poster={clip.posterUrl}
            preload="none"
            playsInline
            onCanPlay={handleVideoCanPlay}
            onEnded={handleVideoEnded}
          >
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

        {/* Caption */}
        <div className="px-4 py-3 bg-space-deep/80">
          <p className="text-white text-center font-medium leading-relaxed">
            "{clip.caption}"
          </p>
          <p className="text-xs text-neon-cyan/50 text-center mt-2">
            Tap anywhere to continue
          </p>
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
