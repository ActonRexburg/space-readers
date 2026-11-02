/**
 * API Service
 * 
 * Handles communication with the backend server.
 * Phase 1: Stubbed endpoints return mock data
 * Phase 2+: Connect to real AI story generation backend
 */

import type { 
  StoryGenerationRequest, 
  StoryGenerationResponse,
  Profile,
  ProfileProgress
} from '../types';

// API configuration
// In Phase 2+, this would be loaded from environment variables
const API_CONFIG = {
  // Base URL for the API server
  // Phase 1: Uses local stubs
  // Phase 2+: Point to actual backend
  baseUrl: import.meta.env.VITE_API_URL || '/api',
  
  // Timeout for API requests (ms)
  timeout: 30000
};

/**
 * Generic fetch wrapper with error handling
 * Used in Phase 2+ when connecting to real backend
 */
export async function apiFetch<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_CONFIG.baseUrl}${endpoint}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    
    throw error;
  }
}

/**
 * Story Generation API (Phase 2 Stub)
 * 
 * In Phase 2, this will call an LLM-powered endpoint that generates
 * decodable stories based on the child's known phonics patterns and interests.
 * 
 * The generated stories will follow these constraints:
 * - Only use words with phonics patterns the child has mastered
 * - Incorporate the child's interests for engagement
 * - Maintain age-appropriate, not-babyish sci-fi themes
 * - Include a word list with grapheme breakdowns
 * 
 * API key should NEVER be in the client - backend handles LLM calls.
 * 
 * Example request:
 * {
 *   profileId: "abc-123",
 *   interests: ["sharks", "rockets", "dinosaurs"],  // From interest picker
 *   knownPhonicsPatterns: ["CVC", "digraph-sh"],
 *   targetPhonicsPatterns: ["digraph-ch"],
 *   difficultyLevel: 2,
 *   theme: "Zib and the shark adventure"  // Auto-generated from interests
 * }
 * 
 * The LLM prompt will incorporate the interests like:
 * "Generate a story where Zib the alien meets a shark in space..."
 */
export async function generateStory(
  request: StoryGenerationRequest
): Promise<StoryGenerationResponse> {
  // Phase 1: Return a stub response showing how interests will be used
  // In production, this would call the real endpoint:
  // return apiFetch<StoryGenerationResponse>('/stories/generate', {
  //   method: 'POST',
  //   body: JSON.stringify(request)
  // });

  console.log('[API Stub] Story generation requested:', {
    profileId: request.profileId,
    interests: request.interests,
    knownPatterns: request.knownPhonicsPatterns,
    targetPatterns: request.targetPhonicsPatterns,
    theme: request.theme
  });

  // Log how interests would be used
  if (request.interests.length > 0) {
    console.log('[API Stub] Would generate story themed around:', request.interests.slice(0, 3).join(', '));
  }
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    success: false,
    error: `Story generation coming in Phase 2! Your interests (${request.interests.slice(0, 3).join(', ')}) will be used to create personalized stories about Zib.`
  };
}

/**
 * Sync profile data with backend (Phase 2+)
 * 
 * In Phase 2, this will sync local data with a cloud database
 * to support multiple devices and teacher dashboards.
 */
export async function syncProfile(
  profile: Profile,
  _progress: ProfileProgress
): Promise<{ success: boolean }> {
  // Phase 1: Return stub response
  console.log('[API Stub] Profile sync requested:', profile.id);
  
  return { success: true };
}

/**
 * Fetch phonics curriculum sequence (Phase 2+)
 * 
 * In Phase 2, this will return the ordered phonics progression
 * to guide story generation and skill tracking.
 */
export async function getPhonicsSequence(): Promise<{
  patterns: Array<{
    id: string;
    name: string;
    description: string;
    examples: string[];
    order: number;
  }>;
}> {
  // Phase 1: Return stub response
  console.log('[API Stub] Phonics sequence requested');
  
  return {
    patterns: [
      { id: 'cvc', name: 'CVC Words', description: 'Consonant-Vowel-Consonant patterns', examples: ['cat', 'dog', 'run'], order: 1 },
      { id: 'digraph-sh', name: 'SH Digraph', description: 'Words with the sh sound', examples: ['ship', 'fish', 'shell'], order: 2 },
      { id: 'digraph-ch', name: 'CH Digraph', description: 'Words with the ch sound', examples: ['chip', 'chat', 'chin'], order: 3 },
      { id: 'digraph-th', name: 'TH Digraph', description: 'Words with the th sound', examples: ['this', 'that', 'them'], order: 4 },
      { id: 'blends', name: 'Consonant Blends', description: 'Two consonants together', examples: ['stop', 'spin', 'glad'], order: 5 },
      { id: 'magic-e', name: 'Magic E', description: 'Silent e makes vowel say its name', examples: ['cake', 'bike', 'home'], order: 6 },
      { id: 'vowel-teams', name: 'Vowel Teams', description: 'Two vowels together', examples: ['rain', 'boat', 'read'], order: 7 }
    ]
  };
}

/**
 * Report analytics to backend (Phase 2+)
 * 
 * In Phase 2, this will send anonymized usage analytics
 * to help improve the curriculum and track progress across classrooms.
 */
export async function reportAnalytics(data: {
  profileId: string;
  event: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // Phase 1: Just log
  console.log('[API Stub] Analytics event:', data.event, data.metadata);
}

// Export the API config for debugging
export { API_CONFIG };
