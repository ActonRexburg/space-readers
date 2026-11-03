/**
 * Parent/Teacher Progress Dashboard
 * 
 * Shows per-child reading progress, words helped, and time spent.
 * Accessible only through the adult gate.
 */

import { useMemo, useState } from 'react';
import type { Profile, ProfileProgress, ProgressSummary } from '../types';
import { getAvatarById, DEFAULT_AVATAR } from '../data/avatars';
import { getInterestsByIds } from '../data/interests';
import { RANK_THRESHOLDS } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { InterestPicker } from './InterestPicker';

interface ProgressDashboardProps {
  profiles: Profile[];
  getProgress: (profileId: string) => ProfileProgress | null;
  onClose: () => void;
  onEditProfile: (profile: Profile) => void;
  onChangePin: () => void;
  onUpdateInterests?: (profile: Profile, interests: string[]) => void;
  zibClipsEnabled?: boolean;
  onToggleZibClips?: (enabled: boolean) => void;
}

export function ProgressDashboard({
  profiles,
  getProgress,
  onClose,
  onEditProfile,
  onChangePin,
  onUpdateInterests,
  zibClipsEnabled = true,
  onToggleZibClips
}: ProgressDashboardProps) {
  const [editingInterestsProfile, setEditingInterestsProfile] = useState<Profile | null>(null);

  // Calculate summary for each profile
  const summaries: ProgressSummary[] = useMemo(() => {
    return profiles.map(profile => {
      const progress = getProgress(profile.id);
      
      if (!progress) {
        return {
          profileId: profile.id,
          profileName: profile.name,
          totalStoriesCompleted: 0,
          totalWordsDecoded: 0,
          currentRank: 'Recruit' as const,
          fuelCredits: 0,
          totalReadingTimeMs: 0,
          mostHelpedWords: [],
          recentSessions: [],
          alienWordsLearned: 0
        };
      }

      // Calculate most helped words (filter out empty/whitespace words)
      const wordEntries = Object.entries(progress.wordHelpCount)
        .filter(([word]) => word && word.trim());
      const mostHelpedWords = wordEntries
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));

      // Calculate total reading time
      const totalReadingTimeMs = progress.sessionHistory.reduce(
        (sum, session) => sum + session.durationMs,
        0
      );

      return {
        profileId: profile.id,
        profileName: profile.name,
        totalStoriesCompleted: progress.storiesCompleted.length,
        totalWordsDecoded: progress.totalWordsDecoded,
        currentRank: progress.currentRank,
        fuelCredits: progress.fuelCredits,
        totalReadingTimeMs,
        mostHelpedWords,
        recentSessions: progress.sessionHistory.slice(-5).reverse(),
        alienWordsLearned: progress.alienLearnedWords.filter(w => w && w.trim()).length
      };
    });
  }, [profiles, getProgress]);

  // Format milliseconds to readable time
  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-space-dark z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-space-deep/90 backdrop-blur-sm border-b border-white/10 p-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">📊 Progress Dashboard</h1>
        <Button variant="ghost" onClick={onClose}>
          Close ✕
        </Button>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        {profiles.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-slate-400 text-lg">No players yet.</p>
            <p className="text-slate-500 mt-2">Create a player profile to start tracking progress.</p>
          </Card>
        ) : (
          <div className="space-y-8">
            {summaries.map(summary => {
              const profile = profiles.find(p => p.id === summary.profileId)!;
              const avatar = getAvatarById(profile.avatarId) || DEFAULT_AVATAR;
              const nextRankIndex = Object.keys(RANK_THRESHOLDS).indexOf(summary.currentRank) + 1;
              const nextRank = Object.keys(RANK_THRESHOLDS)[nextRankIndex];
              const nextThreshold = nextRank ? RANK_THRESHOLDS[nextRank as keyof typeof RANK_THRESHOLDS] : null;
              const rankProgress = nextThreshold 
                ? ((summary.fuelCredits - RANK_THRESHOLDS[summary.currentRank]) / 
                   (nextThreshold - RANK_THRESHOLDS[summary.currentRank])) * 100
                : 100;

              return (
                <Card key={summary.profileId} padding="lg">
                  {/* Profile header */}
                  <div className="flex items-center gap-4 mb-8">
                    <div 
                      className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                      style={{ backgroundColor: `${avatar.color}30`, borderColor: avatar.color, borderWidth: '2px' }}
                    >
                      {avatar.emoji}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold">{summary.profileName}</h2>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span>⭐ {summary.currentRank}</span>
                        <span>•</span>
                        <span>🚀 {summary.fuelCredits} fuel</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onEditProfile(profile)}
                      className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
                    >
                      ⚙️ Edit
                    </button>
                  </div>

                  {/* Rank progress */}
                  {nextRank && (
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{summary.currentRank}</span>
                        <span className="text-star-gold">{nextRank}</span>
                      </div>
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-star-gold to-fuel-orange"
                          style={{ width: `${Math.min(100, rankProgress)}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1 text-right">
                        {nextThreshold! - summary.fuelCredits} fuel to next rank
                      </p>
                    </div>
                  )}

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-nebula-blue">
                        {summary.totalStoriesCompleted}
                      </div>
                      <div className="text-xs text-slate-400">Stories Read</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-alien-green">
                        {summary.totalWordsDecoded}
                      </div>
                      <div className="text-xs text-slate-400">Words Decoded</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-nebula-pink">
                        {formatTime(summary.totalReadingTimeMs)}
                      </div>
                      <div className="text-xs text-slate-400">Time Reading</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-star-gold">
                        {summary.alienWordsLearned}
                      </div>
                      <div className="text-xs text-slate-400">Words Taught to Zib</div>
                    </div>
                  </div>

                  {/* Most helped words */}
                  {summary.mostHelpedWords.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-slate-300 mb-2">
                        📖 Most Practiced Words
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {summary.mostHelpedWords.slice(0, 8).map(({ word, count }) => (
                          <span 
                            key={word}
                            className="px-2 py-1 bg-white/10 rounded text-sm"
                            title={`Practiced ${count} times`}
                          >
                            {word} <span className="text-slate-400">×{count}</span>
                          </span>
                        ))}
                      </div>
                      {summary.mostHelpedWords.length === 0 && (
                        <p className="text-sm text-slate-500">No words practiced yet</p>
                      )}
                    </div>
                  )}

                  {/* Recent sessions */}
                  {summary.recentSessions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-300 mb-2">
                        📅 Recent Reading Sessions
                      </h3>
                      <div className="space-y-1">
                        {summary.recentSessions.map((session, i) => (
                          <div 
                            key={i}
                            className="flex items-center justify-between text-sm py-1 px-2 bg-white/5 rounded"
                          >
                            <span className="text-slate-400">{formatDate(session.date)}</span>
                            <span>{formatTime(session.durationMs)}</span>
                            <span className="text-alien-green">{session.wordsDecoded.length} words</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interests */}
                  <div className="mt-4 pt-4 border-t border-neon-cyan/20">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-neon-cyan">
                        🎯 Interests ({profile.interests.length})
                      </h3>
                      {onUpdateInterests && (
                        <button
                          onClick={() => setEditingInterestsProfile(profile)}
                          className="text-xs text-star-gold hover:underline"
                        >
                          Edit interests
                        </button>
                      )}
                    </div>
                    {profile.interests.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {getInterestsByIds(profile.interests).slice(0, 12).map(interest => (
                          <span 
                            key={interest.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-star-gold/10 border border-star-gold/30 rounded text-sm"
                          >
                            <span>{interest.emoji}</span>
                            <span className="text-star-gold">{interest.label}</span>
                          </span>
                        ))}
                        {profile.interests.length > 12 && (
                          <span className="text-xs text-neon-cyan/50 self-center">
                            +{profile.interests.length - 12} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-neon-cyan/50">No interests selected yet</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Settings section */}
        <div className="mt-8 mb-4">
          <h2 className="text-lg font-semibold mb-3 text-neon-cyan">⚙️ Settings</h2>
          <Card className="space-y-1">
            {/* Zib Clips Toggle */}
            {onToggleZibClips && (
              <button
                onClick={() => onToggleZibClips(!zibClipsEnabled)}
                className="w-full flex items-center justify-between p-3 hover:bg-neon-cyan/10 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👽</span>
                  <div className="text-left">
                    <span className="block">Zib Story Clips</span>
                    <span className="text-xs text-neon-cyan/60">
                      Short videos throughout the app
                    </span>
                  </div>
                </div>
                <div className={`
                  w-12 h-7 rounded-full transition-colors relative
                  ${zibClipsEnabled ? 'bg-alien-green' : 'bg-white/20'}
                `}>
                  <div className={`
                    absolute top-1 w-5 h-5 rounded-full bg-white transition-transform
                    ${zibClipsEnabled ? 'translate-x-6' : 'translate-x-1'}
                  `} />
                </div>
              </button>
            )}
            
            {/* Change PIN */}
            <button
              onClick={onChangePin}
              className="w-full flex items-center justify-between p-3 hover:bg-neon-cyan/10 rounded-lg transition-colors"
            >
              <span>Change Parent PIN</span>
              <span className="text-neon-cyan">→</span>
            </button>
          </Card>
        </div>
      </div>

      {/* Interest Editing Modal */}
      {editingInterestsProfile && onUpdateInterests && (
        <div className="fixed inset-0 z-[60]">
          <InterestPicker
            initialInterests={editingInterestsProfile.interests}
            isEditing={true}
            onComplete={(newInterests) => {
              onUpdateInterests(editingInterestsProfile, newInterests);
              setEditingInterestsProfile(null);
            }}
            onBack={() => setEditingInterestsProfile(null)}
          />
        </div>
      )}
    </div>
  );
}
