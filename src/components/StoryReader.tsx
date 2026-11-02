/**
 * Story Reader Component
 * 
 * Displays a decodable story with tappable words.
 * Tracks reading progress and words decoded.
 * Triggers Zib word_cracked clip on successful decode.
 */

import { useState, useCallback, useRef } from 'react';
import type { Story, DecodableWord } from '../types';
import { WordDecoder } from './WordDecoder';
import { Button } from './Button';
import { getAudioService } from '../services/audio';
import { useZibClips } from './ZibClip';

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
  const startTimeRef = useRef(Date.now());
  const audioService = useRef(getAudioService());
  const { triggerWordCracked, triggerKeepTrying } = useZibClips();

  // Track total words decoded this session
  const wordsDecodedThisSession = useRef<string[]>([]);

  // Handle word tap
  const handleWordTap = useCallback((word: DecodableWord) => {
    setSelectedWord(word);
  }, []);

  // Handle word decode completion
  const handleWordDecoded = useCallback(() => {
    if (selectedWord) {
      const wordText = selectedWord.word.toLowerCase().replace(/[^a-z]/g, '');
      setDecodedWords(prev => new Set([...prev, wordText]));
      wordsDecodedThisSession.current.push(wordText);
      
      // Trigger word_cracked clip (throttled by service)
      triggerWordCracked(story.id);
    }
    setSelectedWord(null);
  }, [selectedWord, story.id, triggerWordCracked]);

  // Handle keep_trying trigger from WordDecoder
  const handleKeepTrying = useCallback(() => {
    triggerKeepTrying();
  }, [triggerKeepTrying]);

  // Handle paragraph navigation
  const handleNextParagraph = useCallback(() => {
    if (currentParagraph < story.paragraphs.length - 1) {
      setCurrentParagraph(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  }, [currentParagraph, story.paragraphs.length]);

  const handlePrevParagraph = useCallback(() => {
    if (currentParagraph > 0) {
      setCurrentParagraph(prev => prev - 1);
    }
  }, [currentParagraph]);

  // Handle story completion
  const handleFinish = useCallback(() => {
    const duration = Date.now() - startTimeRef.current;
    onComplete(wordsDecodedThisSession.current, duration);
  }, [onComplete]);

  // Read entire paragraph aloud
  const readParagraphAloud = useCallback(async () => {
    const paragraph = story.paragraphs[currentParagraph];
    await audioService.current.speakText(paragraph.rawText);
  }, [story.paragraphs, currentParagraph]);

  // Render a single word with styling
  const renderWord = (word: DecodableWord, index: number) => {
    const wordKey = word.word.toLowerCase().replace(/[^a-z]/g, '');
    const wasDecoded = decodedWords.has(wordKey);
    
    return (
      <span
        key={`${word.word}-${index}`}
        onClick={() => handleWordTap(word)}
        className={`
          word-highlight inline-block mx-0.5 cursor-pointer
          ${wasDecoded ? 'text-alien-green' : 'text-white'}
          ${word.isSightWord ? 'italic' : ''}
        `}
      >
        {word.word}
      </span>
    );
  };

  const paragraph = story.paragraphs[currentParagraph];
  const progress = ((currentParagraph + 1) / story.paragraphs.length) * 100;

  if (isFinished) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-space-deep to-space-purple flex flex-col items-center justify-center p-6 z-40">
        <div className="space-card p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-star-gold mb-4">
            Story Complete!
          </h2>
          <p className="text-xl text-slate-300 mb-2">
            "{story.title}"
          </p>
          
          <div className="grid grid-cols-2 gap-4 my-6">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-3xl font-bold text-alien-green">
                {decodedWords.size}
              </div>
              <div className="text-sm text-slate-400">Words Decoded</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-3xl font-bold text-star-gold">
                +{10 + decodedWords.size * 2}
              </div>
              <div className="text-sm text-slate-400">Fuel Earned</div>
            </div>
          </div>

          {decodedWords.size > 0 && (
            <p className="text-alien-green mb-4">
              🛸 Zib learned {decodedWords.size} new words from you!
            </p>
          )}

          <Button 
            variant="success" 
            size="lg" 
            glow 
            onClick={handleFinish}
            className="w-full"
          >
            Continue Mission
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-space-dark to-space-deep flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button 
          onClick={onExit}
          className="text-2xl p-2 hover:bg-white/10 rounded-full"
        >
          ←
        </button>
        
        <h1 className="text-lg font-semibold truncate px-2">
          {story.title}
        </h1>
        
        <button
          onClick={readParagraphAloud}
          className="text-2xl p-2 hover:bg-white/10 rounded-full"
          aria-label="Read aloud"
        >
          🔊
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/10">
        <div 
          className="h-full bg-gradient-to-r from-nebula-blue to-nebula-pink transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Story context */}
      {currentParagraph === 0 && story.storyContext && (
        <div className="p-4 bg-star-gold/10 border-b border-star-gold/30">
          <p className="text-star-gold text-sm italic">
            📖 {story.storyContext}
          </p>
        </div>
      )}

      {/* Main reading area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Paragraph number */}
          <div className="text-sm text-slate-400 mb-4">
            Part {currentParagraph + 1} of {story.paragraphs.length}
          </div>

          {/* Story text */}
          <p className="reading-text leading-relaxed">
            {paragraph.words.map((word, i) => renderWord(word, i))}
          </p>

          {/* Tap hint */}
          <p className="text-sm text-slate-400 mt-6 text-center">
            👆 Tap any word to sound it out
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 border-t border-white/10 flex gap-3">
        <Button
          variant="ghost"
          onClick={handlePrevParagraph}
          disabled={currentParagraph === 0}
          className="flex-1"
        >
          ← Back
        </Button>
        
        <Button
          variant="primary"
          onClick={handleNextParagraph}
          glow={currentParagraph === story.paragraphs.length - 1}
          className="flex-1"
        >
          {currentParagraph === story.paragraphs.length - 1 ? 'Finish ✓' : 'Next →'}
        </Button>
      </div>

      {/* Word decoder popup */}
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
