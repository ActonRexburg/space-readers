/**
 * Avatar Options for Profile Selection
 * 
 * Kid-friendly space-themed avatars using emoji.
 * Each has a unique color theme for the profile card.
 */

import type { Avatar } from '../types';

export const AVATARS: Avatar[] = [
  {
    id: 'astronaut-1',
    name: 'Space Explorer',
    emoji: '👨‍🚀',
    color: '#3b82f6' // blue
  },
  {
    id: 'astronaut-2',
    name: 'Star Voyager',
    emoji: '👩‍🚀',
    color: '#ec4899' // pink
  },
  {
    id: 'rocket',
    name: 'Rocket Rider',
    emoji: '🚀',
    color: '#f97316' // orange
  },
  {
    id: 'alien',
    name: 'Galaxy Friend',
    emoji: '👽',
    color: '#22c55e' // green
  },
  {
    id: 'robot',
    name: 'Robo Pilot',
    emoji: '🤖',
    color: '#8b5cf6' // purple
  },
  {
    id: 'planet',
    name: 'Planet Hopper',
    emoji: '🪐',
    color: '#eab308' // yellow
  },
  {
    id: 'star',
    name: 'Star Chaser',
    emoji: '⭐',
    color: '#fbbf24' // gold
  },
  {
    id: 'comet',
    name: 'Comet Cruiser',
    emoji: '☄️',
    color: '#06b6d4' // cyan
  },
  {
    id: 'moon',
    name: 'Moon Walker',
    emoji: '🌙',
    color: '#94a3b8' // gray
  },
  {
    id: 'ufo',
    name: 'UFO Captain',
    emoji: '🛸',
    color: '#a855f7' // violet
  },
  {
    id: 'satellite',
    name: 'Signal Sender',
    emoji: '🛰️',
    color: '#64748b' // slate
  },
  {
    id: 'telescope',
    name: 'Star Finder',
    emoji: '🔭',
    color: '#0ea5e9' // sky
  }
];

// Get avatar by ID
export function getAvatarById(id: string): Avatar | undefined {
  return AVATARS.find(a => a.id === id);
}

// Default avatar if none selected
export const DEFAULT_AVATAR = AVATARS[0];

// Interest options for profile creation
// These will be used for AI story generation in Phase 2
export const INTEREST_OPTIONS = [
  { id: 'space', label: 'Space & Planets', emoji: '🌌' },
  { id: 'robots', label: 'Robots & Tech', emoji: '🤖' },
  { id: 'animals', label: 'Space Animals', emoji: '🐕' },
  { id: 'adventure', label: 'Adventures', emoji: '🗺️' },
  { id: 'mystery', label: 'Mysteries', emoji: '🔍' },
  { id: 'sports', label: 'Space Sports', emoji: '⚽' },
  { id: 'music', label: 'Music & Sound', emoji: '🎵' },
  { id: 'food', label: 'Space Food', emoji: '🍕' },
  { id: 'building', label: 'Building Things', emoji: '🔧' },
  { id: 'nature', label: 'Alien Nature', emoji: '🌿' }
];
