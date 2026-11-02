/**
 * Bridge Page (Home Screen)
 * 
 * The ship's bridge where the player sees their mission,
 * progress, and Zib the alien. Central hub for navigation.
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
import { getAvatarById, DEFAULT_AVATAR } from '../data/avatars';
import { MISSIONS, getNextMission, getAvailableMissions } from '../data/missions';
import { RANK_THRESHOLDS } from '../types';

export function Bridge() {
  const navigate = useNavigate();
  const { activeProfile, activeProgress, logoutProfile } = useAppStore();
  const { triggerWelcomeBack } = useZibClips();
  const hasTriggeredWelcomeBack = useRef(false);
  
  const [showRankInfo, setShowRankInfo] = useState(false);
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  // Trigger welcome_back for returning cadets (once per bridge visit after first time)
  useEffect(() => {
    if (!hasTriggeredWelcomeBack.current && activeProgress && activeProgress.storiesCompleted.length > 0) {
      hasTriggeredWelcomeBack.current = true;
      // Delay to let UI render
      setTimeout(() => {
        triggerWelcomeBack();
      }, 800);
    }
  }, [activeProgress, triggerWelcomeBack]);

  // Redirect if no active profile
  if (!activeProfile || !activeProgress) {
    navigate('/');
    return null;
  }

  const avatar = getAvatarById(activeProfile.avatarId) || DEFAULT_AVATAR;

  // Get next available mission
  const nextMission = useMemo(() => {
    return getNextMission(
      activeProgress.missionsCompleted,
      activeProgress.currentRank
    );
  }, [activeProgress]);

  // Get all available missions
  const availableMissions = useMemo(() => {
    return getAvailableMissions(
      activeProgress.missionsCompleted,
      activeProgress.currentRank
    );
  }, [activeProgress]);

  // Calculate progress to next rank
  const rankProgress = useMemo(() => {
    const ranks = Object.keys(RANK_THRESHOLDS) as Array<keyof typeof RANK_THRESHOLDS>;
    const currentIndex = ranks.indexOf(activeProgress.currentRank);
    const nextRank = ranks[currentIndex + 1];
    
    if (!nextRank) return { percent: 100, nextRank: null, needed: 0 };
    
    const currentThreshold = RANK_THRESHOLDS[activeProgress.currentRank];
    const nextThreshold = RANK_THRESHOLDS[nextRank];
    const progress = ((activeProgress.fuelCredits - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    
    return {
      percent: Math.min(100, progress),
      nextRank,
      needed: nextThreshold - activeProgress.fuelCredits
    };
  }, [activeProgress]);

  // Zib's dialogue based on progress
  const zibDialogue = useMemo(() => {
    const wordsLearned = activeProgress.alienLearnedWords.length;
    
    if (wordsLearned === 0) {
      return "Hello! I'm Zib. Can you teach me to read?";
    } else if (wordsLearned < 10) {
      return `I know ${wordsLearned} words now! Let's learn more!`;
    } else if (wordsLearned < 25) {
      return "Reading is amazing! Each word opens a new world!";
    } else {
      return "You're an incredible teacher! I can read so much now!";
    }
  }, [activeProgress.alienLearnedWords.length]);

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
      
      {/* Header / Status Bar */}
      <header className="relative z-10 p-4 flex items-center justify-between border-b border-neon-cyan/20 bg-space-deep/80 backdrop-blur-sm">
        {/* Profile info */}
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 hover:bg-neon-cyan/10 rounded-lg p-2 -m-2 transition-colors"
        >
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{ 
              backgroundColor: `${avatar.color}20`, 
              border: `2px solid ${avatar.color}`,
              boxShadow: `0 0 10px ${avatar.color}40`
            }}
          >
            {avatar.emoji}
          </div>
          <div className="text-left">
            <div className="font-semibold">{activeProfile.name}</div>
            <div className="text-xs text-neon-cyan/60">Tap to switch</div>
          </div>
        </button>

        {/* Resources */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 px-3 py-1 rounded-full border border-fuel-orange/50 bg-fuel-orange/10">
            <span>🔥</span>
            <span className="font-bold text-fuel-orange">{activeProgress.fuelCredits}</span>
          </div>
          <div className="flex items-center gap-1 px-3 py-1 rounded-full border border-star-gold/50 bg-star-gold/10">
            <span>⭐</span>
            <span className="font-bold text-star-gold">{activeProgress.starCredits}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Rank Progress */}
          <Card className="relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <button 
                onClick={() => setShowRankInfo(true)}
                className="flex items-center gap-2 hover:underline"
              >
                <span className="text-xl">🎖️</span>
                <span className="font-bold text-star-gold">{activeProgress.currentRank}</span>
              </button>
              {rankProgress.nextRank && (
                <span className="text-sm text-slate-400">
                  {rankProgress.needed} fuel to {rankProgress.nextRank}
                </span>
              )}
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-star-gold to-fuel-orange transition-all duration-500"
                style={{ width: `${rankProgress.percent}%` }}
              />
            </div>
          </Card>

          {/* Zib's Corner */}
          <Card className="flex flex-col sm:flex-row items-center gap-4">
            <Zib 
              expression={activeProgress.alienLearnedWords.length > 0 ? 'happy' : 'curious'}
              learnedWordsCount={activeProgress.alienLearnedWords.length}
              size="md"
            />
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-bold text-lg mb-1 text-neon-cyan">Zib's Reading Log</h3>
              <p className="text-cyan-200/80 text-sm mb-2">{zibDialogue}</p>
              {activeProgress.alienLearnedWords.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center sm:justify-start">
                  {activeProgress.alienLearnedWords.slice(-5).map(word => (
                    <span 
                      key={word}
                      className="px-2 py-0.5 bg-alien-green/20 border border-alien-green/40 rounded text-xs text-alien-green"
                    >
                      {word}
                    </span>
                  ))}
                  {activeProgress.alienLearnedWords.length > 5 && (
                    <span className="text-xs text-neon-cyan/50">
                      +{activeProgress.alienLearnedWords.length - 5} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Mission Briefing Rewatch Button */}
          <button
            onClick={() => setShowIntroVideo(true)}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 hover:bg-neon-cyan/10 hover:border-neon-cyan/50 transition-all"
          >
            <span className="text-xl">📺</span>
            <span className="text-neon-cyan">Watch Mission Briefing</span>
          </button>

          {/* Mission Card */}
          {nextMission ? (
            <Card glow="gold" padding="lg" className="text-center">
              <div className="text-sm text-star-gold mb-1">ACTIVE MISSION</div>
              <h2 className="text-2xl font-bold mb-2">{nextMission.title}</h2>
              <p className="text-slate-300 mb-4">{nextMission.description}</p>
              
              <div className="flex justify-center gap-4 text-sm mb-4">
                <div className="flex items-center gap-1">
                  <span>📚</span>
                  <span>{nextMission.storyIds.length} stories</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>🔥</span>
                  <span>+{nextMission.fuelReward} fuel</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>⭐</span>
                  <span>+{nextMission.starReward} stars</span>
                </div>
              </div>

              <Button 
                variant="success" 
                size="lg" 
                glow 
                onClick={handleStartMission}
                className="w-full sm:w-auto"
              >
                🚀 Start Mission
              </Button>
            </Card>
          ) : (
            <Card padding="lg" className="text-center">
              <div className="text-4xl mb-4">🎉</div>
              <h2 className="text-xl font-bold mb-2">All Missions Complete!</h2>
              <p className="text-slate-300">
                Amazing work! You've completed all available missions.
                New missions coming soon!
              </p>
            </Card>
          )}

          {/* Mission Progress */}
          <Card>
            <h3 className="font-semibold mb-3">Mission Progress</h3>
            <div className="space-y-2">
              {MISSIONS.map(mission => {
                const isCompleted = activeProgress.missionsCompleted.includes(mission.id);
                const isAvailable = availableMissions.some(m => m.id === mission.id);
                const isLocked = !isCompleted && !isAvailable;
                
                return (
                  <div 
                    key={mission.id}
                    className={`
                      flex items-center gap-3 p-2 rounded-lg
                      ${isCompleted ? 'bg-alien-green/20' : ''}
                      ${isAvailable && !isCompleted ? 'bg-star-gold/10' : ''}
                      ${isLocked ? 'opacity-50' : ''}
                    `}
                  >
                    <span className="text-xl">
                      {isCompleted ? '✅' : isLocked ? '🔒' : '📍'}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium">{mission.title}</div>
                      <div className="text-xs text-slate-400">
                        {mission.storyIds.length} stories • {mission.planetId}
                      </div>
                    </div>
                    {isCompleted && (
                      <span className="text-alien-green text-sm">Complete!</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center">
              <div className="text-2xl font-bold text-nebula-blue">
                {activeProgress.storiesCompleted.length}
              </div>
              <div className="text-xs text-slate-400">Stories Read</div>
            </Card>
            <Card className="text-center">
              <div className="text-2xl font-bold text-alien-green">
                {activeProgress.totalWordsDecoded}
              </div>
              <div className="text-xs text-slate-400">Words Decoded</div>
            </Card>
            <Card className="text-center">
              <div className="text-2xl font-bold text-nebula-pink">
                {activeProgress.planetsUnlocked.length}
              </div>
              <div className="text-xs text-slate-400">Planets</div>
            </Card>
          </div>
        </div>
      </main>

      {/* Rank Info Modal */}
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
                  <span className={rank === activeProgress.currentRank ? 'font-bold' : ''}>
                    {rank}
                  </span>
                  <span className="text-sm opacity-70">{fuel} fuel</span>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4" onClick={() => setShowRankInfo(false)}>
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Intro Video Rewatch */}
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
