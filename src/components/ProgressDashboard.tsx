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
import { getStoryById } from '../data/stories';
import { RANK_THRESHOLDS } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { InterestPicker } from './InterestPicker';
import { ConfirmModal } from './ConfirmModal';
import { OverlayPortal, OVERLAY_Z } from './OverlayPortal';
import { getAudioService } from '../services/audio';

interface ProgressDashboardProps {
  profiles: Profile[];
  getProgress: (profileId: string) => ProfileProgress | null;
  onClose: () => void;
  onEditProfile: (profile: Profile) => void;
  onDeleteProfile: (profile: Profile) => void;
  onResetAllData: () => void;
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
  onDeleteProfile,
  onResetAllData,
  onChangePin,
  onUpdateInterests,
  zibClipsEnabled = true,
  onToggleZibClips
}: ProgressDashboardProps) {
  const [editingInterestsProfile, setEditingInterestsProfile] = useState<Profile | null>(null);
  const [manageProfile, setManageProfile] = useState<Profile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [resetStep, setResetStep] = useState<null | 'warn' | 'confirm'>(null);
  const [audioTestBusy, setAudioTestBusy] = useState(false);
  const [audioTestResult, setAudioTestResult] = useState<string | null>(null);

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
        recentSessions: progress.sessionHistory.slice(-12).reverse(),
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
    if (minutes < 1) return '<1m';
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
    <OverlayPortal open>
      <div
        className={`fixed inset-0 ${OVERLAY_Z.baseBackdrop} bg-space-dark`}
        data-overlay-backdrop="parent-dashboard"
        aria-hidden="true"
      />
      <div
        className={`fixed inset-0 ${OVERLAY_Z.baseDialog} overflow-y-auto bg-space-dark`}
        data-testid="parent-dashboard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-dashboard-title"
      >
      {/* Header */}
      <div className="sticky top-0 bg-space-deep/90 backdrop-blur-sm border-b border-white/10 p-4 flex items-center justify-between">
        <h1 id="parent-dashboard-title" className="text-2xl font-bold">📊 Progress Dashboard</h1>
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
                      type="button"
                      data-testid="parent-manage"
                      onClick={() => setManageProfile(profile)}
                      className="p-2 min-w-[44px] min-h-[44px] hover:bg-white/10 rounded-lg text-slate-300 hover:text-white"
                      aria-label={`Manage ${profile.name}`}
                    >
                      Manage
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

                  {/* One row per completed story. Hide only empty accidental taps. */}
                  {summary.recentSessions.filter(s => s.completed || s.durationMs >= 5000 || s.wordsDecoded.length > 0).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-300 mb-2">
                        📅 Recent Reading Sessions
                      </h3>
                      <div className="space-y-1">
                        {summary.recentSessions
                          .filter(s => s.completed || s.durationMs >= 5000 || s.wordsDecoded.length > 0)
                          .map((session, i) => {
                          const storyTitle = getStoryById(session.storyId)?.title ?? 'Story';
                          return (
                          <div 
                            key={i}
                            className="flex items-center justify-between gap-2 text-sm py-1 px-2 bg-white/5 rounded"
                          >
                            <span className="text-slate-300 truncate">{storyTitle}</span>
                            <span className="text-slate-400 shrink-0">{formatDate(session.date)}</span>
                            <span className="shrink-0">{formatTime(session.durationMs)}</span>
                            <span className="text-alien-green shrink-0">
                              {session.wordsDecoded.length} {session.wordsDecoded.length === 1 ? 'word' : 'words'}
                            </span>
                          </div>
                          );
                        })}
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
            
            <div className="p-3">
              <button
                type="button"
                data-testid="audio-test"
                disabled={audioTestBusy}
                onClick={async () => {
                  setAudioTestBusy(true);
                  setAudioTestResult('Playing…');
                  try {
                    const audio = getAudioService();
                    audio.unlock();
                    const result = await audio.runAudioTest();
                    setAudioTestResult(`Zib: ${result.zib}\nMission Control: ${result.control}`);
                  } catch (err) {
                    setAudioTestResult(`error: ${err instanceof Error ? err.message : String(err)}`);
                  } finally {
                    setAudioTestBusy(false);
                  }
                }}
                className="w-full min-h-[48px] rounded-lg px-4 py-3 font-semibold text-left
                  bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-50"
              >
                🔊 Audio test
              </button>
              {audioTestResult && (
                <pre
                  data-testid="audio-test-result"
                  className="mt-2 text-sm whitespace-pre-wrap text-neon-cyan/80"
                >
                  {audioTestResult}
                </pre>
              )}
            </div>

            {/* Change PIN */}
            <button
              onClick={onChangePin}
              className="w-full flex items-center justify-between p-3 hover:bg-neon-cyan/10 rounded-lg transition-colors"
            >
              <span>Change Parent PIN</span>
              <span className="text-neon-cyan">→</span>
            </button>

            {profiles.length > 0 && (
              <button
                type="button"
                onClick={() => setResetStep('warn')}
                className="w-full flex items-center justify-between p-3 hover:bg-red-500/10 rounded-lg transition-colors text-red-400"
              >
                <div className="text-left">
                  <span className="block">Delete all players</span>
                  <span className="text-xs text-red-400/70">Reset this device's kid data</span>
                </div>
                <span>→</span>
              </button>
            )}
          </Card>
        </div>
      </div>

      {/* Manage sheet portals to body so it isn't clipped by .space-card overflow. */}
      <OverlayPortal open={!!manageProfile}>
        <div
          className={`fixed inset-0 ${OVERLAY_Z.nestedBackdrop} bg-black/70 backdrop-blur-sm`}
          data-overlay-backdrop="parent-manage"
          onClick={() => setManageProfile(null)}
          aria-hidden="true"
        />
        <div
          className={`fixed inset-0 ${OVERLAY_Z.nestedDialog} flex items-center justify-center p-4`}
          data-testid="parent-manage-sheet"
          role="dialog"
          aria-modal="true"
        >
          <div className="space-card p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold text-center mb-1">Manage {manageProfile?.name}</h2>
            <p className="text-center text-slate-400 text-sm mb-6">Edit this player or remove them from this device.</p>
            <div className="space-y-3">
              <button
                type="button"
                data-testid="parent-manage-edit"
                onClick={() => {
                  const profile = manageProfile;
                  setManageProfile(null);
                  if (profile) onEditProfile(profile);
                }}
                className="w-full min-h-[48px] rounded-lg px-4 py-3 font-semibold
                  bg-white/10 border border-white/20 hover:bg-white/20 text-left"
              >
                ✏️ Edit name, avatar & interests
              </button>
              <button
                type="button"
                data-testid="parent-manage-delete"
                onClick={() => {
                  setDeleteTarget(manageProfile);
                  setManageProfile(null);
                }}
                className="w-full min-h-[48px] rounded-lg px-4 py-3 font-bold text-left
                  bg-red-600/20 border-2 border-red-400 text-red-300 hover:bg-red-600/30"
              >
                🗑️ Delete player
              </button>
              <button
                type="button"
                onClick={() => setManageProfile(null)}
                className="w-full min-h-[48px] rounded-lg px-4 py-3 font-semibold
                  bg-transparent border border-white/20 text-white/70 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </OverlayPortal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : 'Delete player?'}
        message="This removes all their progress and can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) onDeleteProfile(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        isOpen={resetStep === 'warn'}
        title="Delete all players?"
        message="This removes every player and all their progress from this device."
        confirmLabel="Continue"
        cancelLabel="Cancel"
        destructive={false}
        onConfirm={() => setResetStep('confirm')}
        onCancel={() => setResetStep(null)}
      />

      <ConfirmModal
        isOpen={resetStep === 'confirm'}
        title="This cannot be undone"
        message="Delete everyone on this device? All progress, stories, and profiles will be erased."
        confirmLabel="Delete all players"
        onConfirm={() => {
          setResetStep(null);
          onResetAllData();
        }}
        onCancel={() => setResetStep(null)}
      />

      {/* Interest Editing Modal */}
      <OverlayPortal open={!!editingInterestsProfile && !!onUpdateInterests}>
        <div className={`fixed inset-0 ${OVERLAY_Z.nestedDialog}`}>
          {editingInterestsProfile && onUpdateInterests && (
            <InterestPicker
              initialInterests={editingInterestsProfile.interests}
              isEditing={true}
              onComplete={(newInterests) => {
                onUpdateInterests(editingInterestsProfile, newInterests);
                setEditingInterestsProfile(null);
              }}
              onBack={() => setEditingInterestsProfile(null)}
            />
          )}
        </div>
      </OverlayPortal>
      </div>
    </OverlayPortal>
  );
}
