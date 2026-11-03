/**
 * Story Reader Component
 *
 * Displays a decodable story with tappable words and per-sentence read-aloud.
 * Tapping a word still opens the sound-out decoder.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Story, DecodableWord } from '../types';
import { WordDecoder } from './WordDecoder';
import { Button } from './Button';
import { SpeakButton } from './SpeakButton';
import { getAudioService } from '../services/audio';
import { useZibClips } from './ZibClip';
import { useZibOverlayLock } from '../hooks/useZibOverlayLock';
import { storyCompleteLine } from '../data/voiceLines';
import { getZibClipService } from '../services/zibClips';
import { joinWords, sentenceRanges, wordIndexFromChar } from '../utils/readAloud';

interface StoryReaderProps {
  story: Story;
  onComplete: (wordsDecoded: string[], durationMs: number) => void;
  onExit: () => void;
}

export function StoryReader({ story, onComplete, onExit }: StoryReaderProps) {
  const [selectedWord, setSelectedWord] = useState<DecodableWord | null>(null);
  const [decodedWords, setDecodedWords] = useState<Set<string>>(new Set());
  const [currentParagraph, setCurrentParagraph] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [spokenWordIndex, setSpokenWordIndex] = useState<number | null>(null);
  const startTimeRef = useRef(Date.now());
  const { triggerWordCracked, triggerKeepTrying } = useZibClips();
  const wordsDecodedThisSession = useRef<string[]>([]);

  const handleWordTap = useCallback((word: DecodableWord) => {
    getAudioService().stop();
    getZibClipService().skip();
    setSpokenWordIndex(null);
    setSelectedWord(word);
  }, []);

  const handleWordDecoded = useCallback(() => {
    if (selectedWord) {
      const wordText = selectedWord.word.toLowerCase().replace(/[^a-z]/g, '').trim();
      if (!wordText) {
        setSelectedWord(null);
        return;
      }

      const isNewWord = !decodedWords.has(wordText);
      setDecodedWords(prev => new Set([...prev, wordText]));

      if (isNewWord) {
        wordsDecodedThisSession.current.push(wordText);
      }

      triggerWordCracked(story.id);
    }
    setSelectedWord(null);
  }, [selectedWord, story.id, triggerWordCracked, decodedWords]);

  const handleKeepTrying = useCallback(() => {
    triggerKeepTrying();
  }, [triggerKeepTrying]);

  const handleNextParagraph = useCallback(() => {
    getAudioService().stop();
    setSpokenWordIndex(null);
    if (currentParagraph < story.paragraphs.length - 1) {
      setCurrentParagraph(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  }, [currentParagraph, story.paragraphs.length]);

  const handlePrevParagraph = useCallback(() => {
    getAudioService().stop();
    setSpokenWordIndex(null);
    if (currentParagraph > 0) {
      setCurrentParagraph(prev => prev - 1);
    }
  }, [currentParagraph]);

  const handleFinish = useCallback(() => {
    const duration = Date.now() - startTimeRef.current;
    onComplete(wordsDecodedThisSession.current, duration);
  }, [onComplete]);

  const renderWord = (word: DecodableWord, index: number, isSpeaking: boolean) => {
    const wordKey = word.word.toLowerCase().replace(/[^a-z]/g, '');
    const wasDecoded = decodedWords.has(wordKey);

    return (
      <span
        key={`${word.word}-${index}`}
        onClick={() => handleWordTap(word)}
        className={`
          word-highlight inline-block mx-1 cursor-pointer transition-colors
          ${isSpeaking ? 'word-speaking' : wasDecoded ? 'text-alien-green' : 'text-white'}
          ${word.isSightWord ? 'sight-word' : ''}
        `}
      >
        {word.word}
      </span>
    );
  };

  const paragraph = story.paragraphs[currentParagraph];
  const progress = ((currentParagraph + 1) / story.paragraphs.length) * 100;
  const ranges = sentenceRanges(paragraph.words);
  const completeMessage = storyCompleteLine(story.title);

  useZibOverlayLock(selectedWord !== null || isFinished);

  useEffect(() => {
    if (isFinished) {
      getZibClipService().skip();
    }
  }, [isFinished]);

  if (isFinished) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-space-deep to-space-purple flex flex-col items-center justify-center p-6 z-50">
        <div className="space-card p-8 max-w-md w-full text-center space-y-6">
          <div className="text-6xl">🎉</div>
          <div className="flex items-center justify-center gap-3">
            <h2 className="text-3xl font-bold text-star-gold">Story Complete!</h2>
            <SpeakButton text={completeMessage} voice="control" autoPlay />
          </div>
          <p className="text-xl text-white">{story.title}</p>

          <Button
            variant="success"
            size="lg"
            glow
            onClick={handleFinish}
            className="w-full pulse-action text-xl"
          >
            🚀 Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-space-dark to-space-deep flex flex-col z-40">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <button
          onClick={onExit}
          className="text-xl px-4 py-3 min-h-[44px] hover:bg-white/10 rounded-lg flex items-center gap-2"
        >
          ← Exit
        </button>

        <div className="flex items-center gap-2 min-w-0 flex-1 justify-center px-2">
          <h1 className="text-xl font-semibold truncate">{story.title}</h1>
          <SpeakButton text={story.title} voice="control" />
        </div>

        <div className="w-[88px]" />
      </div>

      <div className="h-2 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-nebula-blue to-nebula-pink transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          {ranges.map((range, si) => {
            const sentenceText = joinWords(paragraph.words, range.start, range.end);
            return (
              <div key={`${paragraph.id}-${si}`} className="flex items-start gap-3">
                <SpeakButton
                  text={sentenceText}
                  voice="story"
                  className="mt-2"
                  onStart={() => setSpokenWordIndex(null)}
                  onWord={(charIndex) => {
                    const local = wordIndexFromChar(sentenceText, charIndex);
                    setSpokenWordIndex(range.start + local);
                  }}
                  onEnd={() => setSpokenWordIndex(null)}
                />
                <p className="story-text-large leading-loose flex-1 min-w-0">
                  {paragraph.words.slice(range.start, range.end).map((word, i) =>
                    renderWord(word, range.start + i, spokenWordIndex === range.start + i)
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-white/10 flex gap-3">
        <Button
          variant="ghost"
          onClick={handlePrevParagraph}
          disabled={currentParagraph === 0}
          className="flex-1 py-4 text-lg"
        >
          ← Back
        </Button>

        <Button
          variant="primary"
          onClick={handleNextParagraph}
          glow
          className="flex-1 py-4 text-lg pulse-idle"
        >
          {currentParagraph === story.paragraphs.length - 1 ? '✓ Finish' : 'Next →'}
        </Button>
      </div>

      <WordDecoder
        word={selectedWord || { word: '', graphemes: [], isSightWord: false, phonicsPatterns: [] }}
        isOpen={selectedWord !== null}
        onClose={() => setSelectedWord(null)}
        onComplete={handleWordDecoded}
        onKeepTrying={handleKeepTrying}
      />
    </div>
  );
}
