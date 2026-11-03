/**
 * Mission Page
 * 
 * Shows mission briefing, story selection, and handles
 * story completion within a mission context.
 * Triggers Zib clips for story_start, story_complete, planet_unlocked, rank_up.
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
import { getMissionById } from '../data/missions';
import { getStoryById } from '../data/stories';
import type { Story, Rank } from '../types';
import { RANK_ORDER, RANK_THRESHOLDS } from '../types';

function calculateRank(fuelCredits: number): Rank {
  let rank: Rank = 'Recruit';
  for (const r of RANK_ORDER) {
    if (fuelCredits >= RANK_THRESHOLDS[r]) {
      rank = r;
    }
  }
  return rank;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

type MissionPhase = 'briefing' | 'stories' | 'reading' | 'debrief' | 'rankup' | 'complete';

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
    triggerStoryComplete, 
    triggerPlanetUnlocked, 
    triggerRankUp 
  } = useZibClips();

  const [phase, setPhase] = useState<MissionPhase>('briefing');
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [completedStories, setCompletedStories] = useState<Set<string>>(new Set());
  const [zibDialogueIndex, setZibDialogueIndex] = useState(0);
  const [totalWordsThisMission, setTotalWordsThisMission] = useState(0);
  const triggeredStoryStartFor = useRef<string | null>(null);
  
  // Track "before" values for visible reward math
  const [fuelBefore, setFuelBefore] = useState(0);
  const [starsBefore, setStarsBefore] = useState(0);
  const [planetsBefore, setPlanetsBefore] = useState(0);
  const [rankBefore, setRankBefore] = useState<string | null>(null);
  const [newRank, setNewRank] = useState<string | null>(null);
  const confettiPieces = useMemo(() => (
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${(i * 17) % 100}%`,
      delay: `${(i % 8) * 0.25}s`,
      duration: `${2 + (i % 4) * 0.5}s`,
      emoji: ['🎉', '⭐', '🌟', '✨', '🏆', '🎖️'][i % 6]
    }))
  ), []);

  // Get mission data
  const mission = useMemo(() => {
    if (!missionId) return null;
    return getMissionById(missionId);
  }, [missionId]);

  // Get stories for this mission
  const stories = useMemo(() => {
    if (!mission) return [];
    return mission.storyIds
      .map(id => getStoryById(id))
      .filter((s): s is Story => s !== undefined);
  }, [mission]);

  // Check if all stories are completed
  const allStoriesCompleted = useMemo(() => {
    return stories.every(s => completedStories.has(s.id));
  }, [stories, completedStories]);

  // Handle starting a story
  const handleStartStory = useCallback((story: Story) => {
    setCurrentStory(story);
    setPhase('reading');
    
    // Trigger story_start clip (once per story)
    if (triggeredStoryStartFor.current !== story.id) {
      triggeredStoryStartFor.current = story.id;
      setTimeout(() => {
        triggerStoryStart(story.id);
      }, 500);
    }
  }, [triggerStoryStart]);

  // Handle story completion
  const handleStoryComplete = useCallback(async (wordsDecoded: string[], durationMs: number) => {
    if (!currentStory) return;

    const uniqueWords = wordsDecoded.filter(w => w && w.trim());

    // Record the story completion (adds story fuel to the store)
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

    triggerStoryComplete();

    if (newCompletedStories.size === stories.length && mission) {
      // Read the store AFTER story rewards so "before" matches what Claim Rewards adds to
      const latest = useAppStore.getState().activeProgress;
      const fuelAfterStories = latest?.fuelCredits ?? 0;
      const starsAfterStories = latest?.starCredits ?? 0;
      const planetsAfterStories = latest?.planetsUnlocked.length ?? 0;
      const rankAfterStories = latest?.currentRank ?? 'Recruit';
      const fuelAfterMission = fuelAfterStories + mission.fuelReward;
      const rankAfterMission = calculateRank(fuelAfterMission);

      setFuelBefore(fuelAfterStories);
      setStarsBefore(starsAfterStories);
      setPlanetsBefore(planetsAfterStories);
      setRankBefore(rankAfterStories);

      if (rankAfterMission !== rankAfterStories) {
        setNewRank(rankAfterMission);
      }
      setPhase('debrief');
    } else {
      setPhase('stories');
    }
  }, [currentStory, stories.length, completedStories, completeStory, addAlienWord, recordWordHelp, triggerStoryComplete, mission]);

  // Handle mission completion
  const handleMissionComplete = useCallback(async () => {
    if (!mission) return;

    await completeMission(mission.id, mission.fuelReward, mission.starReward, mission.unlocksPlanet);
    
    // Check for rank change - show full-screen celebration
    if (newRank && newRank !== rankBefore) {
      setTimeout(() => triggerRankUp(), 300);
      setPhase('rankup');
    } else {
      // No rank change - trigger planet unlock if applicable and go to complete
      if (mission.unlocksPlanet) {
        setTimeout(() => triggerPlanetUnlocked(), 300);
      }
      setPhase('complete');
    }
  }, [mission, completeMission, triggerRankUp, triggerPlanetUnlocked, newRank, rankBefore]);

  // Handle continuing after rank-up celebration
  const handleContinueAfterRankUp = useCallback(() => {
    if (mission?.unlocksPlanet) {
      setTimeout(() => triggerPlanetUnlocked(), 300);
    }
    setPhase('complete');
  }, [mission, triggerPlanetUnlocked]);

  // Dismiss lingering Zib popups when leaving a story or finishing the mission
  useEffect(() => {
    if (phase === 'stories' || phase === 'complete' || phase === 'briefing') {
      getZibClipService().skip();
    }
  }, [phase]);

  // Navigate back
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

  // Render based on current phase
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <Starfield />

      {/* Header */}
      {phase !== 'reading' && (
        <header className="relative z-10 p-4 flex items-center justify-between border-b border-white/10 bg-space-deep/50 backdrop-blur-sm">
          <button 
            onClick={handleBack}
            className="flex items-center gap-2 hover:bg-white/10 rounded-lg p-2 -m-2"
          >
            <span className="text-xl">←</span>
            <span>Back</span>
          </button>
          <h1 className="font-bold">{mission.title}</h1>
          <div className="w-16" /> {/* Spacer for centering */}
        </header>
      )}

      {/* Mission Briefing Phase */}
      {phase === 'briefing' && (
        <main className="flex-1 relative z-10 p-4 flex flex-col items-center justify-center">
          <div className="max-w-md w-full space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-2">🎯</div>
              <h2 className="text-2xl font-bold text-star-gold">Mission Briefing</h2>
            </div>

            <Card padding="lg">
              <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                {mission.briefing}
              </p>
            </Card>

            <Card className="flex items-center gap-4">
              <Zib size="sm" />
              <div className="flex-1">
                <p className="text-slate-300 italic">
                  "{mission.alienDialogue[zibDialogueIndex]}"
                </p>
                {zibDialogueIndex < mission.alienDialogue.length - 1 && (
                  <button
                    onClick={() => setZibDialogueIndex(i => i + 1)}
                    className="text-sm text-star-gold mt-1 hover:underline"
                  >
                    Next →
                  </button>
                )}
              </div>
            </Card>

            <div className="flex gap-2 justify-center text-sm text-slate-400">
              <span>📚 {stories.length} stories</span>
              <span>•</span>
              <span>🔥 +{mission.fuelReward} fuel</span>
              <span>•</span>
              <span>⭐ +{mission.starReward} stars</span>
            </div>

            <Button 
              variant="success" 
              size="lg" 
              glow 
              onClick={() => setPhase('stories')}
              className="w-full"
            >
              Accept Mission 🚀
            </Button>
          </div>
        </main>
      )}

      {/* Story Selection Phase */}
      {phase === 'stories' && (
        <main className="flex-1 relative z-10 p-4 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">Choose a Story</h2>
              <p className="text-slate-400">
                Complete all stories to finish the mission
              </p>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-alien-green transition-all duration-300"
                  style={{ width: `${(completedStories.size / stories.length) * 100}%` }}
                />
              </div>
              <span className="text-sm text-slate-400">
                {completedStories.size}/{stories.length}
              </span>
            </div>

            {/* Story List */}
            <div className="space-y-3">
              {stories.map((story, index) => {
                const isCompleted = completedStories.has(story.id);
                
                return (
                  <Card 
                    key={story.id}
                    glow={!isCompleted ? 'gold' : 'green'}
                    onClick={() => handleStartStory(story)}
                    className="cursor-pointer hover:scale-[1.02] transition-transform"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center text-xl
                        ${isCompleted ? 'bg-alien-green/30' : 'bg-white/10'}
                      `}>
                        {isCompleted ? '✅' : `${index + 1}`}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold">{story.title}</h3>
                        <p className="text-sm text-slate-400">
                          {story.paragraphs.length} parts • Level {story.difficultyLevel}
                        </p>
                      </div>
                      {!isCompleted && (
                        <span className="text-star-gold">Read →</span>
                      )}
                    </div>
                    {story.storyContext && (
                      <p className="mt-2 text-sm text-slate-300 italic">
                        {story.storyContext}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Complete Mission Button */}
            {allStoriesCompleted && (
              <Button 
                variant="success" 
                size="lg" 
                glow 
                onClick={() => setPhase('debrief')}
                className="w-full mt-6"
              >
                Complete Mission ✓
              </Button>
            )}
          </div>
        </main>
      )}

      {/* Reading Phase */}
      {phase === 'reading' && currentStory && (
        <StoryReader
          story={currentStory}
          onComplete={handleStoryComplete}
          onExit={handleBack}
        />
      )}

      {/* Debrief Phase */}
      {phase === 'debrief' && (
        <main className="flex-1 relative z-10 p-4 flex flex-col items-center justify-center overflow-y-auto">
          <div className="max-w-md w-full space-y-6 py-4">
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold text-star-gold">Mission Complete!</h2>
            </div>

            <Card padding="lg">
              <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                {mission.completionMessage}
              </p>
            </Card>

            <Card className="flex items-center gap-4">
              <Zib size="md" />
              <div className="flex-1 text-center">
                <p className="text-alien-green font-bold text-lg">
                  Zib learned {totalWordsThisMission} new words!
                </p>
                <p className="text-slate-300 text-sm mt-1">
                  Thank you for teaching me!
                </p>
              </div>
            </Card>

            {/* Rewards with visible math */}
            <Card glow="gold" className="text-center">
              <h3 className="font-bold mb-4 text-lg">Mission Rewards</h3>
              
              {/* Fuel math */}
              <div className="bg-white/5 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-center gap-2 text-fuel-orange">
                  <span className="text-xl">{fuelBefore}</span>
                  <span className="text-lg">+</span>
                  <span className="text-xl font-bold">{mission.fuelReward}</span>
                  <span className="text-lg">=</span>
                  <span className="text-2xl font-bold">{fuelBefore + mission.fuelReward}</span>
                </div>
                <div className="text-sm text-slate-400 mt-1">🔥 Fuel Credits</div>
              </div>
              
              {/* Stars math */}
              <div className="bg-white/5 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-center gap-2 text-star-gold">
                  <span className="text-xl">{starsBefore}</span>
                  <span className="text-lg">+</span>
                  <span className="text-xl font-bold">{mission.starReward}</span>
                  <span className="text-lg">=</span>
                  <span className="text-2xl font-bold">{starsBefore + mission.starReward}</span>
                </div>
                <div className="text-sm text-slate-400 mt-1">⭐ Star Credits</div>
              </div>
              
              {newRank && newRank !== rankBefore && (
                <p className="mt-3 text-alien-green font-medium">
                  🎖️ Rank up waiting after you claim rewards!
                </p>
              )}

              {/* Planet unlock celebration */}
              {mission.unlocksPlanet && (
                <div className="mt-4 p-3 bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg">
                  <div className="text-2xl mb-1">🌍</div>
                  <div className="text-neon-cyan font-bold text-lg">
                    {capitalize(mission.unlocksPlanet)} Unlocked!
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-2 text-slate-300">
                    <span>Planets:</span>
                    <span className="text-xl">{planetsBefore}</span>
                    <span>→</span>
                    <span className="text-xl font-bold text-neon-cyan">{planetsBefore + 1}</span>
                  </div>
                </div>
              )}
            </Card>

            <Button 
              variant="success" 
              size="lg" 
              glow 
              onClick={handleMissionComplete}
              className="w-full"
            >
              Claim Rewards 🎁
            </Button>
          </div>
        </main>
      )}

      {/* Full-screen Rank-Up Celebration Phase */}
      {phase === 'rankup' && newRank && (
        <main className="flex-1 relative z-10 p-4 flex flex-col items-center justify-center overflow-hidden">
          {/* Confetti effect */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {confettiPieces.map((piece) => (
              <div
                key={piece.id}
                className="absolute animate-confetti"
                style={{
                  left: piece.left,
                  animationDelay: piece.delay,
                  animationDuration: piece.duration,
                }}
              >
                {piece.emoji}
              </div>
            ))}
          </div>
          
          <div className="max-w-md w-full text-center space-y-8 relative z-10">
            {/* Big rank badge */}
            <div className="relative">
              <div className="text-8xl mb-4 animate-bounce">🎖️</div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-alien-green/20 animate-ping" />
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-alien-green text-glow-cyan">
              RANK UP!
            </h2>
            
            <div className="space-card p-6 glow-green">
              <div className="flex items-center justify-center gap-4 text-2xl">
                <span className="text-slate-400">{rankBefore}</span>
                <span className="text-alien-green text-3xl">→</span>
                <span className="text-alien-green font-bold text-3xl text-glow-cyan">{newRank}</span>
              </div>
              <p className="text-alien-green mt-4 italic">
                "You did it, Cadet! You ranked up!"
              </p>
              <p className="text-slate-300 mt-2">
                Congratulations, {newRank}! Your reading skills are out of this world!
              </p>
            </div>
            
            <Button 
              variant="success" 
              size="lg" 
              glow 
              onClick={handleContinueAfterRankUp}
              className="w-full"
            >
              Continue 🚀
            </Button>
          </div>
        </main>
      )}

      {/* Complete Phase */}
      {phase === 'complete' && (
        <main className="flex-1 relative z-10 p-4 flex flex-col items-center justify-center">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-2xl font-bold">Ready for More Adventures?</h2>
            <p className="text-slate-300">
              Return to the bridge to see your progress and find new missions!
            </p>
            <Button 
              variant="primary" 
              size="lg" 
              onClick={() => navigate('/bridge')}
              className="w-full"
            >
              Return to Bridge
            </Button>
          </div>
        </main>
      )}
    </div>
  );
}
