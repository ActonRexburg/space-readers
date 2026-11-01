/**
 * Phase 2 API Server Stub
 * 
 * This file provides a blueprint for the backend server that will handle:
 * - AI story generation using LLM APIs
 * - User authentication and profile sync
 * - Multi-tenant data management (schools, classrooms)
 * - Analytics and reporting
 * 
 * To run in production, this would be deployed as a separate service
 * (e.g., Node.js/Express, Deno, or serverless functions).
 * 
 * IMPORTANT: API keys and secrets should be environment variables,
 * NEVER exposed to the client.
 */

// Example Express.js server structure
// import express from 'express';
// import cors from 'cors';
// import { Configuration, OpenAIApi } from 'openai';

// Types for the API
interface StoryGenerationRequest {
  profileId: string;
  interests: string[];
  knownPhonicsPatterns: string[];
  targetPhonicsPatterns: string[];
  difficultyLevel: number;
  wordCount?: number;
  theme?: string;
}

interface GeneratedStory {
  id: string;
  title: string;
  paragraphs: Array<{
    id: string;
    rawText: string;
    words: Array<{
      word: string;
      graphemes: Array<{ text: string; phoneme: string }>;
      isSightWord: boolean;
      phonicsPatterns: string[];
    }>;
  }>;
  phonicsPatterns: string[];
  targetWords: string[];
  sightWords: string[];
  difficultyLevel: number;
}

// ============================================
// STORY GENERATION ENDPOINT (Phase 2)
// ============================================

/**
 * POST /api/stories/generate
 * 
 * Generates a decodable story using an LLM (e.g., GPT-4, Claude)
 * constrained to the child's known phonics patterns.
 * 
 * The prompt engineering ensures:
 * 1. Only words with known phonics patterns are used
 * 2. Child's interests are incorporated
 * 3. Age-appropriate, not-babyish sci-fi themes
 * 4. Proper grapheme segmentation is included
 */
const STORY_GENERATION_PROMPT = `
You are a children's literacy expert creating decodable stories for 8-9 year old readers.

Generate a short space-themed story following these STRICT rules:

1. PHONICS PATTERNS: Only use words containing these patterns: {knownPatterns}
   - CVC words are always allowed
   - Sight words allowed: {sightWords}
   
2. TARGET WORDS: Include practice for these new patterns: {targetPatterns}

3. INTERESTS: Incorporate these themes naturally: {interests}

4. TONE: Age-appropriate, cool, not babyish. Think Star Wars for kids, not baby books.

5. LENGTH: {wordCount} words, divided into {paragraphCount} short paragraphs.

6. FORMAT: Return JSON with this structure:
{
  "title": "Story Title",
  "paragraphs": [
    { "text": "First paragraph text..." },
    { "text": "Second paragraph text..." }
  ],
  "targetWords": ["word1", "word2"]
}

IMPORTANT: Every word must be decodable using the specified patterns or be a listed sight word.
`;

async function generateStoryHandler(req: StoryGenerationRequest): Promise<GeneratedStory> {
  // In production, this would:
  // 1. Validate the request
  // 2. Build the prompt with the child's constraints
  // 3. Call the LLM API (OpenAI, Anthropic, etc.)
  // 4. Parse and validate the response
  // 5. Add grapheme segmentation to each word
  // 6. Return the formatted story

  throw new Error('Not implemented - Phase 2 feature');
}

// ============================================
// PHONICS CURRICULUM ENDPOINT
// ============================================

/**
 * GET /api/phonics/sequence
 * 
 * Returns the ordered phonics progression used to track
 * skill mastery and constrain story generation.
 */
const PHONICS_SEQUENCE = [
  {
    id: 'cvc-short-a',
    name: 'CVC Short A',
    description: 'Three letter words with short a sound',
    examples: ['cat', 'hat', 'man', 'can', 'ran'],
    order: 1
  },
  {
    id: 'cvc-short-i',
    name: 'CVC Short I',
    description: 'Three letter words with short i sound',
    examples: ['sit', 'hit', 'big', 'dig', 'pig'],
    order: 2
  },
  {
    id: 'cvc-short-o',
    name: 'CVC Short O',
    description: 'Three letter words with short o sound',
    examples: ['hot', 'pot', 'dog', 'log', 'fog'],
    order: 3
  },
  {
    id: 'cvc-short-u',
    name: 'CVC Short U',
    description: 'Three letter words with short u sound',
    examples: ['cup', 'pup', 'sun', 'run', 'fun'],
    order: 4
  },
  {
    id: 'cvc-short-e',
    name: 'CVC Short E',
    description: 'Three letter words with short e sound',
    examples: ['bed', 'red', 'jet', 'pet', 'wet'],
    order: 5
  },
  {
    id: 'digraph-sh',
    name: 'SH Digraph',
    description: 'Words containing the sh sound',
    examples: ['ship', 'shop', 'fish', 'wish', 'shell'],
    order: 6
  },
  {
    id: 'digraph-ch',
    name: 'CH Digraph',
    description: 'Words containing the ch sound',
    examples: ['chip', 'chop', 'much', 'such', 'chat'],
    order: 7
  },
  {
    id: 'digraph-th',
    name: 'TH Digraph',
    description: 'Words containing the th sound',
    examples: ['this', 'that', 'with', 'path', 'bath'],
    order: 8
  },
  {
    id: 'digraph-wh',
    name: 'WH Digraph',
    description: 'Words containing the wh sound',
    examples: ['when', 'what', 'whip', 'which', 'while'],
    order: 9
  },
  {
    id: 'blends-initial',
    name: 'Initial Consonant Blends',
    description: 'Words starting with two consonant sounds',
    examples: ['stop', 'spin', 'glad', 'trip', 'drop'],
    order: 10
  },
  {
    id: 'blends-final',
    name: 'Final Consonant Blends',
    description: 'Words ending with two consonant sounds',
    examples: ['fast', 'best', 'hand', 'jump', 'milk'],
    order: 11
  },
  {
    id: 'magic-e-a',
    name: 'Magic E with A',
    description: 'Silent e makes a say its name',
    examples: ['cake', 'make', 'lake', 'take', 'bake'],
    order: 12
  },
  {
    id: 'magic-e-i',
    name: 'Magic E with I',
    description: 'Silent e makes i say its name',
    examples: ['bike', 'like', 'time', 'five', 'hide'],
    order: 13
  },
  {
    id: 'magic-e-o',
    name: 'Magic E with O',
    description: 'Silent e makes o say its name',
    examples: ['home', 'bone', 'rope', 'note', 'hope'],
    order: 14
  },
  {
    id: 'vowel-team-ai-ay',
    name: 'AI/AY Vowel Teams',
    description: 'Two vowels making the long a sound',
    examples: ['rain', 'train', 'play', 'stay', 'day'],
    order: 15
  },
  {
    id: 'vowel-team-ea-ee',
    name: 'EA/EE Vowel Teams',
    description: 'Two vowels making the long e sound',
    examples: ['read', 'team', 'tree', 'see', 'keep'],
    order: 16
  },
  {
    id: 'vowel-team-oa-ow',
    name: 'OA/OW Vowel Teams',
    description: 'Two vowels making the long o sound',
    examples: ['boat', 'coat', 'snow', 'grow', 'show'],
    order: 17
  },
  {
    id: 'r-controlled-ar',
    name: 'R-Controlled AR',
    description: 'The ar sound in words',
    examples: ['car', 'star', 'far', 'dark', 'park'],
    order: 18
  },
  {
    id: 'r-controlled-or',
    name: 'R-Controlled OR',
    description: 'The or sound in words',
    examples: ['for', 'corn', 'fork', 'sort', 'storm'],
    order: 19
  },
  {
    id: 'r-controlled-er-ir-ur',
    name: 'R-Controlled ER/IR/UR',
    description: 'The er sound spelled different ways',
    examples: ['her', 'bird', 'turn', 'first', 'burn'],
    order: 20
  }
];

// ============================================
// MULTI-TENANT DATA MODELS (Phase 3)
// ============================================

/**
 * Database schema for schools/classrooms
 * 
 * In Phase 3, this supports:
 * - Multiple schools with separate data
 * - Classrooms within schools
 * - Teacher accounts with dashboard access
 * - Student grouping and assignment
 */

interface School {
  id: string;
  name: string;
  createdAt: Date;
  settings: {
    allowCustomStories: boolean;
    parentAccessEnabled: boolean;
  };
}

interface Classroom {
  id: string;
  schoolId: string;
  name: string;
  teacherId: string;
  createdAt: Date;
}

interface Teacher {
  id: string;
  email: string;
  name: string;
  schoolId: string;
  classroomIds: string[];
}

// ============================================
// DEPLOYMENT NOTES
// ============================================

/**
 * Recommended deployment for Phase 2+:
 * 
 * 1. Backend: Node.js/Express or serverless (Vercel, AWS Lambda)
 * 2. Database: PostgreSQL or MongoDB for multi-tenant data
 * 3. Auth: Firebase Auth or Auth0 for teacher/parent accounts
 * 4. LLM API: OpenAI GPT-4 or Anthropic Claude for story generation
 * 5. Hosting: Vercel, Netlify, or AWS Amplify for the frontend
 * 
 * Environment variables needed:
 * - OPENAI_API_KEY (or ANTHROPIC_API_KEY)
 * - DATABASE_URL
 * - AUTH_SECRET
 * - CORS_ORIGIN
 */

export {
  STORY_GENERATION_PROMPT,
  PHONICS_SEQUENCE,
  generateStoryHandler
};
