/**
 * ZibClip Component
 *
 * Comm-link popup for Zib story clips.
 * Videos stay on screen until they play or the cadet taps Skip/Got it.
 * Do not auto-dismiss during load — a ~6s cap was unmounting the popup
 * before Chromebooks finished fetching the mp4 (Brian: clips "don't seem
 * to be loading").
 *
 * Autoplay uses muted + playsInline (Chrome allows that without a gesture).
 * If even muted play is blocked, show a large Play button.
 * Failures log with console.info('[zibclip] ...').
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { getZibClipService, type PendingClip } from '../services/zibClips';
import { resolveAssetUrl } from '../utils/assets';

const ZIB_POSTER = resolveAssetUrl('zib-clips/poster/zib_interest_picker_intro.jpg');

interface ZibClipProps {
  position?: 'top-right' | 'center' | 'bottom-center' | 'bottom-left';
}

export function ZibClip({ position = 'bottom-left' }: ZibClipProps) {
  const [pendingClip, setPendingClip] = useState<PendingClip | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsPlayButton, setNeedsPlayButton] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const autoplayTried = useRef(false);
  const service = getZibClipService();
  const location = useLocation();
  const [routePath, setRoutePath] = useState(location.pathname);
  const clipOnThisRoute = location.pathname === routePath ? pendingClip : null;
  if (location.pathname !== routePath) {
    setRoutePath(location.pathname);
    setPendingClip(null);
  }

  useEffect(() => {
    service.skip();
    setPendingClip(null);
  }, [location.pathname, service]);

  useEffect(() => {
    const unsubscribe = service.subscribe((clip) => {
      setPendingClip(clip);
      setIsVideoLoaded(false);
      setIsPlaying(false);
      setNeedsPlayButton(false);
      setVideoFailed(false);
      autoplayTried.current = false;
      if (clip) {
        console.info('[zibclip] show', clip.clip.id, clip.mode);
      }
    });
    setPendingClip(service.getCurrentClip());
    return unsubscribe;
  }, [service]);

  const tryAutoplay = useCallback((video: HTMLVideoElement, clipId: string) => {
    video.muted = true;
    video.playsInline = true;
    const playPromise = video.play();
    if (playPromise === undefined) {
      setIsPlaying(true);
      return;
    }
    playPromise
      .then(() => {
        console.info('[zibclip] autoplay muted ok', clipId);
        setIsPlaying(true);
        video.muted = false;
        // Unmuting after muted autoplay often needs a tap on ChromeOS.
        if (video.muted) {
          console.info('[zibclip] still muted, showing play for sound', clipId);
          setNeedsPlayButton(true);
        } else {
          setNeedsPlayButton(false);
        }
      })
      .catch((error: DOMException) => {
        console.info('[zibclip] autoplay blocked', clipId, error?.name, error?.message);
        setIsPlaying(false);
        setNeedsPlayButton(true);
      });
  }, []);

  const handleVideoCanPlay = useCallback(() => {
    const video = videoRef.current;
    const clip = pendingClip?.clip;
    if (!video || !clip) return;
    if (!isVideoLoaded) {
      console.info('[zibclip] canplay', clip.id);
      setIsVideoLoaded(true);
    }
    if (!autoplayTried.current && !isPlaying && !needsPlayButton) {
      autoplayTried.current = true;
      tryAutoplay(video, clip.id);
    }
  }, [pendingClip, isVideoLoaded, isPlaying, needsPlayButton, tryAutoplay]);

  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    const err = video?.error;
    console.info(
      '[zibclip] video error',
      pendingClip?.clip.id,
      err?.code,
      err?.message,
      video?.currentSrc
    );
    setVideoFailed(true);
    setNeedsPlayButton(false);
  }, [pendingClip]);

  const handleVideoEnded = useCallback(() => {
    console.info('[zibclip] ended', pendingClip?.clip.id);
    setIsPlaying(false);
    setTimeout(() => service.complete(), 500);
  }, [service, pendingClip]);

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    setTimeout(() => service.complete(), 300);
  }, [service]);

  const handleDismiss = useCallback(() => {
    if (videoRef.current) videoRef.current.pause();
    if (audioRef.current) audioRef.current.pause();
    console.info('[zibclip] dismiss', pendingClip?.clip.id);
    service.skip();
  }, [service, pendingClip]);

  const handleManualPlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.playsInline = true;
    const p = video.play();
    if (p === undefined) {
      setIsPlaying(true);
      setNeedsPlayButton(false);
      return;
    }
    p.then(() => {
      console.info('[zibclip] manual play ok', pendingClip?.clip.id);
      setIsPlaying(true);
      setNeedsPlayButton(false);
    }).catch((error: DOMException) => {
      console.info('[zibclip] manual play failed', error?.name, error?.message);
      video.muted = true;
      video.play()
        .then(() => {
          setIsPlaying(true);
          setNeedsPlayButton(false);
        })
        .catch((err: DOMException) => {
          console.info('[zibclip] muted retry failed', err?.name, err?.message);
        });
    });
  }, [pendingClip]);

  // Voice-only: try audio.play(); if blocked, cadet taps Got it (no silent 6s skip).
  useEffect(() => {
    if (!pendingClip) return;
    if (pendingClip.mode !== 'voice' && !videoFailed) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = pendingClip.clip.voiceUrl;
    audio.play()
      .then(() => {
        console.info('[zibclip] voice play ok', pendingClip.clip.id);
        setIsPlaying(true);
      })
      .catch((error: DOMException) => {
        console.info('[zibclip] voice play failed', pendingClip.clip.id, error?.name, error?.message);
      });
  }, [pendingClip, videoFailed]);

  if (!clipOnThisRoute) return null;

  const { clip, mode } = clipOnThisRoute;

  const positionClasses = {
    'top-right': 'top-16 right-4',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'bottom-center': 'bottom-24 left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-28 left-3'
  };

  if (mode === 'voice' || videoFailed) {
    return createPortal(
      <>
        <audio
          ref={audioRef}
          onEnded={handleAudioEnded}
          preload="auto"
        />
        <div
          className={`fixed ${positionClasses[position]} z-40`}
          data-testid="zib-comm-link"
        >
          <div className="zib-comm-link-mini p-4 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-alien-green shrink-0 glow-green">
              <img
                src={clip.posterUrl || ZIB_POSTER}
                alt="Zib"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-lg text-white font-medium leading-snug text-center w-full">
              "{clip.caption}"
            </p>
            <button
              onClick={handleDismiss}
              className="w-full px-6 py-3 min-h-[56px] bg-alien-green/20 hover:bg-alien-green/30 border-2 border-alien-green/60 rounded-lg text-alien-green font-bold text-xl transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      </>,
      document.body
    );
  }

  return createPortal(
    <div
      className={`fixed ${positionClasses[position]} z-40`}
      data-testid="zib-comm-link"
    >
      <div className="zib-comm-link">
        <div className="flex items-center justify-between px-4 py-2 border-b border-neon-cyan/30">
          <div className="flex items-center gap-2">
            <span className="text-lg">📡</span>
            <span className="text-sm font-bold text-neon-cyan uppercase tracking-wider">
              Zib's Comm-Link
            </span>
          </div>
          <button
            className="px-4 py-2 min-w-[56px] min-h-[56px] text-white/80 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
          >
            Skip ✕
          </button>
        </div>

        <div className="relative aspect-video bg-black/50">
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

          <video
            key={clip.id}
            ref={videoRef}
            className={`w-full h-full object-cover ${isVideoLoaded ? 'opacity-100' : 'opacity-0'}`}
            poster={clip.posterUrl}
            preload="auto"
            playsInline
            muted
            onLoadedMetadata={() => {
              console.info('[zibclip] metadata', clip.id);
            }}
            onCanPlay={handleVideoCanPlay}
            onEnded={handleVideoEnded}
            onError={handleVideoError}
          >
            <source src={clip.videoWebmUrl} type="video/webm" />
            <source src={clip.videoUrl} type="video/mp4" />
          </video>

          {isVideoLoaded && (!isPlaying || needsPlayButton) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <button
                type="button"
                className="w-20 h-20 rounded-full bg-neon-cyan/30 border-4 border-neon-cyan flex items-center justify-center shadow-[0_0_20px_rgba(0,245,255,0.5)]"
                onClick={handleManualPlay}
                aria-label="Play Zib clip"
              >
                <span className="text-4xl ml-1">▶</span>
              </button>
            </div>
          )}
        </div>

        <div className="px-4 py-3 bg-space-deep/80 flex flex-col gap-3">
          <p className="text-lg text-white font-medium leading-snug">
            "{clip.caption}"
          </p>
          <button
            onClick={handleDismiss}
            className="w-full px-6 py-3 min-h-[56px] bg-alien-green/20 hover:bg-alien-green/30 border-2 border-alien-green/60 rounded-lg text-alien-green font-bold text-xl transition-colors"
          >
            Got it!
          </button>
        </div>

        <div className="zib-scanline" />
      </div>
    </div>,
    document.body
  );
}

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
