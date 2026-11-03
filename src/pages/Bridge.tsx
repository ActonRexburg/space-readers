/**
 * Bridge Page (Home Screen)
 *
 * The ship's bridge where the player sees their mission and Zib.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { Starfield } from '../components/Starfield';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Zib } from '../components/Zib';
import { IntroVideo } from '../components/IntroVideo';
import { useZibClips } from '../components/ZibClip';
import { useZibOverlayLock } from '../hooks/useZibOverlayLock';
import { SpeakButton, SpokenLine } from '../components/SpeakButton';
import { ParentZone } from '../components/ParentZone';
import { getAudioService } from '../services/audio';
import { getAvatarById, DEFAULT_AVATAR } from '../data/avatars';
import { getNextMission } from '../data/missions';
import { UI, zibWordsKnownLine, ZIB } from '../data/voiceLines';
import { RANK_THRESHOLDS } from '../types';
import { useIdleGlow } from '../hooks/useIdleGlow';

export function Bridge() {
  const navigate = useNavigate();
  const { activeProfile, activeProgress, logoutProfile } = useAppStore();
  const { triggerWelcomeBack } = useZibClips();
  const hasTriggeredWelcomeBack = useRef(false);

  const [showRankInfo, setShowRankInfo] = useState(false);
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  useZibOverlayLock(showRankInfo || showIntroVideo);
  const nextMission = useMemo(() => {
    if (!activeProgress) return null;
    return getNextMission(
      activeProgress.missionsCompleted,
      activeProgress.currentRank
    );
  }, [activeProgress]);
  // Start Mission is the only idle-glow on the Bridge (none if every mission is done).
  const idleGlow = useIdleGlow(!!nextMission && !showRankInfo && !showIntroVideo);

  useEffect(() => {
    if (!hasTriggeredWelcomeBack.current && activeProgress && activeProgress.storiesCompleted.length > 0) {
      hasTriggeredWelcomeBack.current = true;
      setTimeout(() => {
        triggerWelcomeBack();
      }, 800);
    }
  }, [activeProgress, triggerWelcomeBack]);

  const rankProgress = useMemo(() => {
    if (!activeProgress) return { percent: 0, nextRank: null as string | null };
    const ranks = Object.keys(RANK_THRESHOLDS) as Array<keyof typeof RANK_THRESHOLDS>;
    const currentIndex = ranks.indexOf(activeProgress.currentRank);
    const nextRank = ranks[currentIndex + 1];

    if (!nextRank) return { percent: 100, nextRank: null };

    const currentThreshold = RANK_THRESHOLDS[activeProgress.currentRank];
    const nextThreshold = RANK_THRESHOLDS[nextRank];
    const progress = ((activeProgress.fuelCredits - currentThreshold) / (nextThreshold - currentThreshold)) * 100;

    return {
      percent: Math.min(100, progress),
      nextRank
    };
  }, [activeProgress]);

  const zibDialogue = useMemo(() => {
    const wordsLearned = activeProgress?.alienLearnedWords.length ?? 0;

    if (wordsLearned === 0) {
      return ZIB.helloTeach;
    } else if (wordsLearned < 10) {
      return zibWordsKnownLine(wordsLearned);
    } else if (wordsLearned < 25) {
      return ZIB.readingAmazing;
    } else {
      return ZIB.incredibleTeacher;
    }
  }, [activeProgress?.alienLearnedWords.length]);

  useEffect(() => {
    if (!activeProfile || !activeProgress) {
      navigate('/');
    }
  }, [activeProfile, activeProgress, navigate]);

  if (!activeProfile || !activeProgress) {
    return null;
  }

  const avatar = getAvatarById(activeProfile.avatarId) || DEFAULT_AVATAR;

  const handleLogout = () => {
    logoutProfile();
    navigate('/');
  };

  const handleStartMission = () => {
    if (nextMission) {
      navigate(`/mission/${nextMission.id}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-space-dark">
      <Starfield />

      <header className="relative z-10 p-4 flex items-center justify-between border-b border-neon-cyan/20 bg-space-deep/80 backdrop-blur-sm">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 hover:bg-neon-cyan/10 rounded-lg p-2 -m-2 transition-colors"
          aria-label="Switch player"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
            style={{
              backgroundColor: `${avatar.color}20`,
              border: `2px solid ${avatar.color}`,
              boxShadow: `0 0 10px ${avatar.color}40`
            }}
          >
            {avatar.emoji}
          </div>
          <div className="text-left text-lg font-semibold">{activeProfile.name}</div>
        </button>

        <div className="flex items-center gap-3">
          <ParentZone />
          <button
            type="button"
            onClick={() => getAudioService().speakText(UI.fuel, { voice: 'control' })}
            className="flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-full border border-fuel-orange/50 bg-fuel-orange/10"
            aria-label="Fuel"
          >
            <span className="text-xl">🔥</span>
            <span className="font-bold text-lg text-fuel-orange">{activeProgress.fuelCredits}</span>
          </button>
          <button
            type="button"
            onClick={() => getAudioService().speakText(UI.stars, { voice: 'control' })}
            className="flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-full border border-star-gold/50 bg-star-gold/10"
            aria-label="Stars"
          >
            <span className="text-xl">⭐</span>
            <span className="font-bold text-lg text-star-gold">{activeProgress.starCredits}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 relative z-10 p-6 overflow-y-auto">
        <div className="max-w-xl mx-auto space-y-8">

          <Card className="relative overflow-hidden">
            <button
              onClick={() => setShowRankInfo(true)}
              className="w-full"
              aria-label="Space ranks"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-2">
                  <span className="text-2xl">🎖️</span>
                  <span className="font-bold text-xl text-star-gold">{activeProgress.currentRank}</span>
                </span>
                {rankProgress.nextRank && (
                  <span className="flex items-center gap-1 text-lg text-white/80">
                    <span className="text-xl">➡️</span>
                    <span>{rankProgress.nextRank}</span>
                  </span>
                )}
              </div>
              <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-star-gold to-fuel-orange transition-all duration-500"
                  style={{ width: `${rankProgress.percent}%` }}
                />
              </div>
            </button>
          </Card>

          <Card className="flex flex-col sm:flex-row items-center gap-5 p-6">
            <Zib
              expression={activeProgress.alienLearnedWords.length > 0 ? 'happy' : 'curious'}
              size="md"
            />
            <SpokenLine
              text={zibDialogue}
              voice="zib"
              className="flex-1"
              textClassName="text-xl text-cyan-100 leading-snug"
            />
          </Card>

          <button
            onClick={() => setShowIntroVideo(true)}
            className="w-full flex items-center justify-center gap-3 p-4 min-h-[56px] rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 hover:bg-neon-cyan/10 hover:border-neon-cyan/50 transition-all text-lg text-neon-cyan"
          >
            <span className="text-2xl">📺</span>
            <span>Briefing</span>
          </button>

          {nextMission ? (
            <Card glow="gold" padding="lg" className="text-center space-y-5">
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-3xl font-bold">{nextMission.title}</h2>
                <SpeakButton
                  voice="control"
                  text={`${nextMission.title}. ${nextMission.description}`}
                />
              </div>
              <SpokenLine
                text={nextMission.description}
                voice="control"
                className="justify-center"
                textClassName="text-xl text-white leading-snug"
              />

              <Button
                variant="success"
                size="lg"
                glow
                onClick={handleStartMission}
                className={`w-full text-2xl py-5 ${idleGlow}`}
              >
                🚀 Start Mission
              </Button>
            </Card>
          ) : (
            <Card padding="lg" className="text-center space-y-4">
              <div className="text-5xl">🎉</div>
              <SpokenLine
                text={UI.allDone}
                voice="control"
                className="justify-center"
                textClassName="text-2xl font-bold"
              />
            </Card>
          )}
        </div>
      </main>

      {showRankInfo && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRankInfo(false)}
        >
          <div className="space-card p-6 max-w-sm w-full neon-border-cyan" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-center mb-4 text-glow-cyan">🎖️ Space Ranks</h2>
            <div className="space-y-2">
              {Object.entries(RANK_THRESHOLDS).map(([rank, fuel]) => (
                <div
                  key={rank}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border
                    ${rank === activeProgress.currentRank
                      ? 'bg-star-gold/20 border-star-gold text-star-gold'
                      : 'bg-white/5 border-white/10'}
                  `}
                >
                  <span className={rank === activeProgress.currentRank ? 'font-bold text-lg' : 'text-lg'}>
                    {rank}
                  </span>
                  <span className="text-lg opacity-70">{fuel} 🔥</span>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4" onClick={() => setShowRankInfo(false)}>
              Close
            </Button>
          </div>
        </div>
      )}

      {showIntroVideo && (
        <IntroVideo
          onComplete={() => setShowIntroVideo(false)}
          onSkip={() => setShowIntroVideo(false)}
          showSkip={true}
        />
      )}
    </div>
  );
}
