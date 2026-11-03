/**
 * Mission Page
 *
 * Shows mission briefing, story selection, and handles
 * story completion within a mission context.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { getZibClipService } from '../services/zibClips';
import { Starfield } from '../components/Starfield';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Zib } from '../components/Zib';
import { StoryReader } from '../components/StoryReader';
import { useZibClips } from '../components/ZibClip';
import { useZibOverlayLock } from '../hooks/useZibOverlayLock';
import { SpeakButton, SpokenLine } from '../components/SpeakButton';
import { getMissionById } from '../data/missions';
import { getStoryById } from '../data/stories';
import { zibLearnedLine, zibRankUpLine, planetUnlockedLine, UI } from '../data/voiceLines';
import { splitSentences } from '../utils/readAloud';
import type { Story, Rank } from '../types';
import { RANK_ORDER, RANK_THRESHOLDS } from '../types';
import { useIdleGlow } from '../hooks/useIdleGlow';

function calculateRank(fuelCredits: number): Rank {
  let rank: Rank = 'Recruit';
  for (const r of RANK_ORDER) {
    if (fuelCredits >= RANK_THRESHOLDS[r]) {
      rank = r;
    }
  }
  return rank;
}

type MissionPhase = 'briefing' | 'stories' | 'reading' | 'debrief' | 'rankup';

export function Mission() {
  const { missionId } = useParams<{ missionId: string }>();
  const navigate = useNavigate();
  const {
    completeStory,
    completeMission,
    addAlienWord,
    recordWordHelp
  } = useAppStore();
  const {
    triggerStoryStart,
    triggerStoryComplete
  } = useZibClips();

  const [phase, setPhase] = useState<MissionPhase>('briefing');
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [completedStories, setCompletedStories] = useState<Set<string>>(new Set());
  const [zibDialogueIndex, setZibDialogueIndex] = useState(0);
  const [totalWordsThisMission, setTotalWordsThisMission] = useState(0);
  const triggeredStoryStartFor = useRef<string | null>(null);

  const [fuelAtStart] = useState(() => useAppStore.getState().activeProgress?.fuelCredits ?? 0);
  const [starsAtStart] = useState(() => useAppStore.getState().activeProgress?.starCredits ?? 0);
  const [storyFuelEarned, setStoryFuelEarned] = useState(0);
  const [planetsBefore, setPlanetsBefore] = useState(0);
  const [rankBefore, setRankBefore] = useState<string | null>(null);
  const [newRank, setNewRank] = useState<string | null>(null);

  // Hide Zib popups on Mission Complete and rank-up overlays.
  useZibOverlayLock(phase === 'debrief' || phase === 'rankup');
  // One idle-glow CTA per mission phase; StoryReader owns the reading-phase CTA.
  const idleGlow = useIdleGlow(phase !== 'reading');

  const confettiPieces = useMemo(() => (
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${(i * 17) % 100}%`,
      delay: `${(i % 8) * 0.4}s`,
      emoji: ['🎉', '⭐', '🌟', '✨', '🏆', '🎖️'][i % 6]
    }))
  ), []);

  const mission = useMemo(() => {
    if (!missionId) return null;
    return getMissionById(missionId);
  }, [missionId]);

  const stories = useMemo(() => {
    if (!mission) return [];
    return mission.storyIds
      .map(id => getStoryById(id))
      .filter((s): s is Story => s !== undefined);
  }, [mission]);

  const allStoriesCompleted = useMemo(() => {
    return stories.every(s => completedStories.has(s.id));
  }, [stories, completedStories]);

  const firstIncompleteStoryId = stories.find(s => !completedStories.has(s.id))?.id;

  const handleStartStory = useCallback((story: Story) => {
    setCurrentStory(story);
    setPhase('reading');

    if (triggeredStoryStartFor.current !== story.id) {
      triggeredStoryStartFor.current = story.id;
      setTimeout(() => {
        triggerStoryStart(story.id);
      }, 500);
    }
  }, [triggerStoryStart]);

  const handleStoryComplete = useCallback(async (wordsDecoded: string[], durationMs: number) => {
    if (!currentStory) return;

    const uniqueWords = wordsDecoded.filter(w => w && w.trim());

    await completeStory(currentStory.id, uniqueWords, durationMs);

    for (const word of uniqueWords) {
      await addAlienWord(word);
    }
    for (const word of uniqueWords) {
      await recordWordHelp(word);
    }

    const newCompletedStories = new Set([...completedStories, currentStory.id]);
    setCompletedStories(newCompletedStories);
    setTotalWordsThisMission(prev => prev + uniqueWords.length);
    setCurrentStory(null);
    triggeredStoryStartFor.current = null;

    if (newCompletedStories.size === stories.length && mission) {
      // Overlay coming — do not leave a clip on Mission Complete.
      getZibClipService().skip();
      const latest = useAppStore.getState().activeProgress;
      const fuelAfterStories = latest?.fuelCredits ?? 0;
      const planetsAfterStories = latest?.planetsUnlocked.length ?? 0;
      const rankAfterStories = latest?.currentRank ?? 'Recruit';
      const fuelAfterMission = fuelAfterStories + mission.fuelReward;
      const rankAfterMission = calculateRank(fuelAfterMission);

      setStoryFuelEarned(fuelAfterStories - fuelAtStart);
      setPlanetsBefore(planetsAfterStories);
      setRankBefore(rankAfterStories);

      if (rankAfterMission !== rankAfterStories) {
        setNewRank(rankAfterMission);
      }
      setPhase('debrief');
    } else {
      triggerStoryComplete();
      setPhase('stories');
    }
  }, [currentStory, stories.length, completedStories, completeStory, addAlienWord, recordWordHelp, triggerStoryComplete, mission, fuelAtStart]);

  const handleMissionComplete = useCallback(async () => {
    if (!mission) return;

    await completeMission(mission.id, mission.fuelReward, mission.starReward, mission.unlocksPlanet);

    getZibClipService().skip();
    if (newRank && newRank !== rankBefore) {
      setPhase('rankup');
    } else {
      navigate('/bridge');
    }
  }, [mission, completeMission, newRank, rankBefore, navigate]);

  const handleContinueAfterRankUp = useCallback(() => {
    getZibClipService().skip();
    navigate('/bridge');
  }, [navigate]);

  useEffect(() => {
    if (phase === 'stories' || phase === 'briefing' || phase === 'debrief' || phase === 'rankup') {
      getZibClipService().skip();
    }
  }, [phase]);

  const handleBack = () => {
    if (phase === 'reading') {
      setCurrentStory(null);
      setPhase('stories');
    } else {
      navigate('/bridge');
    }
  };

  if (!mission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Starfield />
        <div className="text-center">
          <p className="text-xl">Mission not found</p>
          <Button variant="ghost" onClick={() => navigate('/bridge')} className="mt-4">
            Return to Bridge
          </Button>
        </div>
      </div>
    );
  }

  const briefingSentences = splitSentences(mission.briefing);
  const zibLine = mission.alienDialogue[zibDialogueIndex] || '';
  const fuelTotal = fuelAtStart + storyFuelEarned + mission.fuelReward;
  const starTotal = starsAtStart + mission.starReward;
  const fuelSpeak = `Before ${fuelAtStart}. Story fuel plus ${storyFuelEarned}. Mission bonus plus ${mission.fuelReward}. Total ${fuelTotal}.`;
  const rankSpeak = newRank ? zibRankUpLine(newRank) : '';

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <Starfield />

      {phase !== 'reading' && (
        <header className="relative z-10 p-4 flex items-center justify-between border-b border-white/10 bg-space-deep/50 backdrop-blur-sm">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 hover:bg-white/10 rounded-lg p-3 min-h-[44px] -m-2 text-lg"
          >
            <span className="text-xl">←</span>
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-bold text-lg truncate">{mission.title}</h1>
            <SpeakButton text={mission.title} voice="control" />
          </div>
          <div className="w-16" />
        </header>
      )}

      {phase === 'briefing' && (
        <main className="flex-1 relative z-10 p-6 flex flex-col items-center justify-center">
          <div className="max-w-md w-full space-y-6">
            <div className="flex flex-col items-center gap-3">
              <div className="text-5xl">🎯</div>
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold text-star-gold">{mission.title}</h2>
                <SpeakButton text={mission.title} voice="control" />
              </div>
            </div>

            <SpokenLine
              text={mission.description}
              autoPlay
              voice="control"
              textClassName="text-xl text-star-gold font-bold text-center"
              className="justify-center"
            />

            <Card className="space-y-3 p-5">
              {briefingSentences.map((line) => (
                <SpokenLine
                  key={line}
                  text={line}
                  voice="control"
                  textClassName="text-xl text-white leading-snug"
                />
              ))}
            </Card>

            <Card className="flex items-center gap-4 p-5">
              <Zib size="sm" />
              <div className="flex-1 min-w-0">
                <SpokenLine
                  text={zibLine}
                  voice="zib"
                  textClassName="text-xl text-cyan-100 leading-snug"
                />
                {zibDialogueIndex < mission.alienDialogue.length - 1 && (
                  <button
                    onClick={() => setZibDialogueIndex(i => i + 1)}
                    className={`mt-3 min-h-[44px] px-4 rounded-lg text-xl text-star-gold ${idleGlow}`}
                  >
                    Next →
                  </button>
                )}
              </div>
            </Card>

            <Button
              variant="success"
              size="lg"
              glow
              onClick={() => setPhase('stories')}
              className={`w-full text-2xl ${zibDialogueIndex >= mission.alienDialogue.length - 1 ? idleGlow : ''}`}
            >
              🚀 Accept
            </Button>
          </div>
        </main>
      )}

      {phase === 'stories' && (
        <main className="flex-1 relative z-10 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-alien-green transition-all duration-300"
                  style={{ width: `${(completedStories.size / stories.length) * 100}%` }}
                />
              </div>
              <span className="text-lg text-white">
                {completedStories.size}/{stories.length}
              </span>
            </div>

            <div className="space-y-4">
              {stories.map((story, index) => {
                const isCompleted = completedStories.has(story.id);
                const isPrimary = !allStoriesCompleted && story.id === firstIncompleteStoryId;

                return (
                  <Card
                    key={story.id}
                    glow={!isCompleted ? 'gold' : 'green'}
                    onClick={() => handleStartStory(story)}
                    className={`cursor-pointer hover:scale-[1.02] transition-transform ${isPrimary ? idleGlow : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`
                        w-14 h-14 rounded-full flex items-center justify-center text-2xl
                        ${isCompleted ? 'bg-alien-green/30' : 'bg-white/10'}
                      `}>
                        {isCompleted ? '✅' : `${index + 1}`}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <h3 className="font-bold text-xl truncate">{story.title}</h3>
                        <SpeakButton
                          voice="control"
                          text={story.storyContext ? `${story.title}. ${story.storyContext}` : story.title}
                        />
                      </div>
                      {!isCompleted && (
                        <span className="text-star-gold text-xl shrink-0">▶</span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {allStoriesCompleted && (
              <Button
                variant="success"
                size="lg"
                glow
                onClick={() => setPhase('debrief')}
                className={`w-full mt-4 text-xl ${idleGlow}`}
              >
                ✓ Complete
              </Button>
            )}
          </div>
        </main>
      )}

      {phase === 'reading' && currentStory && (
        <StoryReader
          story={currentStory}
          onComplete={handleStoryComplete}
          onExit={handleBack}
        />
      )}

      {phase === 'debrief' && (
        <main className="flex-1 relative z-50 p-6 flex flex-col items-center justify-center overflow-y-auto">
          <div className="max-w-md w-full space-y-8 py-4">
            <div className="text-center space-y-3">
              <div className="text-6xl">🎉</div>
              <SpokenLine
                text={UI.missionComplete}
                autoPlay
                voice="control"
                className="justify-center"
                textClassName="text-3xl font-bold text-star-gold"
              />
              <SpokenLine
                text={mission.completionMessage}
                voice="control"
                className="justify-center"
                textClassName="text-xl text-white leading-snug"
              />
            </div>

            <Card className="flex items-center gap-4 p-5">
              <Zib size="md" />
              <SpokenLine
                text={zibLearnedLine(totalWordsThisMission)}
                voice="zib"
                textClassName="text-xl text-alien-green font-bold"
              />
            </Card>

            <Card glow="gold" className="text-center space-y-3">
              {/* Breakdown starts from pre-mission fuel so it matches the Bridge before and after. */}
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-2">
                  <SpeakButton text={fuelSpeak} voice="control" className="shrink-0" />
                  <div className="text-fuel-orange space-y-1 text-xl font-bold text-center">
                    <div>Before {fuelAtStart} 🔥</div>
                    <div>Story fuel +{storyFuelEarned}</div>
                    <div>Mission bonus +{mission.fuelReward}</div>
                    <div className="text-2xl">Total {fuelTotal} 🔥</div>
                  </div>
                </div>
              </div>
              <div className="text-star-gold space-y-1 text-xl font-bold pt-2 text-center">
                <div>Before {starsAtStart} ⭐</div>
                <div>Mission bonus +{mission.starReward}</div>
                <div className="text-2xl">Total {starTotal} ⭐</div>
              </div>

              {mission.unlocksPlanet && (
                <div className="p-4 bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg">
                  <div className="text-3xl mb-1">🌍</div>
                  <SpokenLine
                    text={planetUnlockedLine(mission.unlocksPlanet)}
                    voice="control"
                    className="justify-center"
                    textClassName="text-xl text-neon-cyan font-bold"
                  />
                  <div className="text-lg text-white mt-1">
                    Planets: {planetsBefore} → {planetsBefore + 1}
                  </div>
                </div>
              )}
            </Card>

            <Button
              variant="success"
              size="lg"
              glow
              onClick={handleMissionComplete}
              className={`w-full text-2xl ${idleGlow}`}
            >
              🎁 Claim Rewards
            </Button>
          </div>
        </main>
      )}

      {phase === 'rankup' && newRank && (
        <main className="flex-1 relative z-50 p-6 flex flex-col items-center justify-center overflow-hidden">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {confettiPieces.map((piece) => (
              <div
                key={piece.id}
                className="absolute animate-confetti"
                style={{
                  left: piece.left,
                  animationDelay: piece.delay,
                }}
              >
                {piece.emoji}
              </div>
            ))}
          </div>

          <div className="max-w-md w-full text-center space-y-8 relative z-10">
            <div className="relative">
              <div className="text-8xl mb-4">🎖️</div>
            </div>

            <SpokenLine
              text={UI.rankUp}
              voice="control"
              autoPlay
              className="justify-center"
              textClassName="text-4xl font-bold text-alien-green text-glow-cyan"
            />
            {rankSpeak && (
              <SpokenLine
                text={rankSpeak}
                voice="zib"
                className="justify-center"
                textClassName="text-2xl text-white"
              />
            )}

            <div className="space-card p-6 glow-green">
              <div className="flex items-center justify-center gap-4 text-2xl">
                <span className="text-slate-400">{rankBefore}</span>
                <span className="text-alien-green text-3xl">→</span>
                <span className="text-alien-green font-bold text-3xl text-glow-cyan">{newRank}</span>
              </div>
            </div>

            <Button
              variant="success"
              size="lg"
              glow
              onClick={handleContinueAfterRankUp}
              className={`w-full text-xl ${idleGlow}`}
            >
              🚀 Continue
            </Button>
          </div>
        </main>
      )}

    </div>
  );
}
