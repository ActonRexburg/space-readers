/**
 * Bridge — the ship's cockpit home screen.
 *
 * One full-bleed starfield scene: windshield, star-map path, docked ship,
 * and a single low-profile console. No separate stat/ship/mission cards.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { Starfield } from '../components/Starfield';
import { CockpitFrame } from '../components/CockpitFrame';
import { StarMap } from '../components/StarMap';
import { Button } from '../components/Button';
import { IntroVideo } from '../components/IntroVideo';
import { useZibClips } from '../components/ZibClip';
import { useZibOverlayLock } from '../hooks/useZibOverlayLock';
import { SpeakButton, SpokenLine } from '../components/SpeakButton';
import { ParentZone } from '../components/ParentZone';
import { getAudioService } from '../services/audio';
import { getAvatarById, DEFAULT_AVATAR } from '../data/avatars';
import { AvatarImage } from '../components/AvatarImage';
import { getMissionMap, getNextMission } from '../data/missions';
import { UI, zibWordsKnownLine, ZIB } from '../data/voiceLines';
import { RANK_THRESHOLDS } from '../types';
import type { Rank } from '../types';
import { useIdleGlow } from '../hooks/useIdleGlow';
import { ZibShip } from '../components/ZibShip';
import { RankBadge } from '../components/RankBadge';
import { hydrateShipProgress, SHIP_ENERGY_MAX } from '../data/ship';
import { resolveAssetUrl } from '../utils/assets';

const ZIB_SCENE = resolveAssetUrl('zib-clips/poster/zib_planet_unlocked.jpg');

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
  const missionMap = useMemo(() => {
    if (!activeProgress) return [];
    return getMissionMap(
      activeProgress.missionsCompleted,
      activeProgress.currentRank
    );
  }, [activeProgress]);
  // Start Mission is the only idle-glow on the Bridge (none if every mission is done).
  const currentNode = missionMap.find((n) => n.status === 'current') ?? null;
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

  const ship = useMemo(
    () => hydrateShipProgress(activeProgress),
    [activeProgress]
  );

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

  const handleOpenMission = (missionId: string) => {
    navigate(`/mission/${missionId}`);
  };

  const missionSpeak = nextMission
    ? `${nextMission.title}. ${nextMission.description}`
    : UI.allDone;

  return (
    <div className="bridge-cockpit" data-testid="bridge-cockpit">
      <Starfield />
      <CockpitFrame />
      <div className="bridge-hud-bar" aria-hidden="true" />
      <div className="bridge-console-bar" aria-hidden="true" />

      <div className="bridge-player">
        <AvatarImage avatar={avatar} size="sm" alt="" />
        <div className="bridge-player-meta">
          <div className="bridge-player-name heading-text">{activeProfile.name}</div>
          <div className="bridge-player-stats">
            <button
              type="button"
              onClick={() => getAudioService().speakText(UI.fuel, { voice: 'control' })}
              className="bridge-stat"
              aria-label="Fuel"
            >
              <span aria-hidden="true">🔥</span>
              <span className="font-bold text-fuel-orange">{activeProgress.fuelCredits}</span>
            </button>
            <button
              type="button"
              onClick={() => getAudioService().speakText(UI.stars, { voice: 'control' })}
              className="bridge-stat"
              aria-label="Stars"
            >
              <span aria-hidden="true">⭐</span>
              <span className="font-bold text-star-gold">{activeProgress.starCredits}</span>
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowRankInfo(true)}
        className="bridge-rank"
        data-testid="bridge-rank-card"
        aria-label="Space ranks"
      >
        <RankBadge rank={activeProgress.currentRank} size="sm" />
        <div className="bridge-rank-meta">
          <span className="bridge-rank-name heading-text">{activeProgress.currentRank}</span>
          <span className="bridge-rank-bar" aria-hidden="true">
            <span
              className="bridge-rank-fill"
              style={{ width: `${rankProgress.percent}%` }}
            />
          </span>
        </div>
      </button>

      <div className="bridge-tools">
        <ParentZone className="bridge-icon-btn" />
        <button
          type="button"
          onClick={handleLogout}
          className="bridge-icon-btn bridge-switch"
          aria-label="Switch player"
          data-testid="bridge-switch-player"
        >
          <SwitchPlayerIcon />
        </button>
      </div>

      <StarMap
        nodes={missionMap}
        onOpenMission={handleOpenMission}
        docked={
          <>
            <div className="hero-ship">
              <ZibShip
                energy={ship.shipEnergy}
                parts={ship.shipPartsUnlocked}
                phase="idle"
                size="hero"
              />
              <div className="hero-energy" data-testid="bridge-ship-energy">
                {ship.shipEnergy} / {SHIP_ENERGY_MAX}
              </div>
            </div>
            <div className="hero-zib">
              <div className="zib-speech">
                <p className="instruction-text">{zibDialogue}</p>
                <SpeakButton text={zibDialogue} voice="zib" />
              </div>
              <img
                src={ZIB_SCENE}
                alt=""
                className="bridge-zib-figure"
                draggable={false}
              />
            </div>
          </>
        }
      />

      <div className="bridge-mission">
        {nextMission ? (
          <>
            <div className="bridge-mission-title">
              <h2 className="heading-text">{nextMission.title}</h2>
              <SpeakButton voice="control" text={missionSpeak} />
            </div>
            <div className="bridge-mission-actions">
              <Button
                variant="success"
                size="lg"
                glow
                onClick={handleStartMission}
                className={`bridge-start ${idleGlow}`}
              >
                START MISSION
              </Button>
              <button
                type="button"
                onClick={() => setShowIntroVideo(true)}
                className="bridge-briefing"
              >
                <PlayIcon />
                <span>Briefing</span>
              </button>
            </div>
          </>
        ) : currentNode && !currentNode.completed ? (
          <>
            <div className="bridge-mission-title">
              <h2 className="heading-text">{currentNode.mission.title}</h2>
              <SpeakButton
                voice="control"
                text={`${currentNode.mission.title}. ${currentNode.mission.description}`}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowIntroVideo(true)}
              className="bridge-briefing"
            >
              <PlayIcon />
              <span>Briefing</span>
            </button>
          </>
        ) : (
          <>
            <SpokenLine
              text={UI.allDone}
              voice="control"
              heading
              className="bridge-all-done"
              textClassName="text-2xl font-bold"
            />
            <button
              type="button"
              onClick={() => setShowIntroVideo(true)}
              className="bridge-briefing"
            >
              <PlayIcon />
              <span>Briefing</span>
            </button>
          </>
        )}
      </div>

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
                  <span className={`flex items-center gap-2 ${rank === activeProgress.currentRank ? 'font-bold text-lg' : 'text-lg'}`}>
                    <RankBadge rank={rank as Rank} size="sm" />
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

function SwitchPlayerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.2 19c.3-3.2 2.6-5.2 5.8-5.2s5.5 2 5.8 5.2H3.2z" />
      <circle cx="17" cy="9.2" r="2.5" />
      <path d="M13.4 19c.25-2.2 1.7-3.6 3.6-3.6s3.35 1.4 3.6 3.6H13.4z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}
