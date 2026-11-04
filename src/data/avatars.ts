/**
 * Avatar Options for Profile Selection
 *
 * Illustrated character art in public/avatars/<id>.webp (Brian's 12).
 * emoji stays as a fallback if the image 404s. Existing profiles keep
 * working because the ids are unchanged.
 */

import type { Avatar } from '../types';
import { resolveAssetUrl } from '../utils/assets';

function avatarImage(id: string): string {
  return resolveAssetUrl(`avatars/${id}.webp`);
}

export const AVATARS: Avatar[] = [
  {
    id: 'astronaut-1',
    name: 'Space Explorer',
    image: avatarImage('astronaut-1'),
    emoji: '👨‍🚀',
    color: '#3b82f6' // blue
  },
  {
    id: 'astronaut-2',
    name: 'Star Voyager',
    image: avatarImage('astronaut-2'),
    emoji: '👩‍🚀',
    color: '#ec4899' // pink
  },
  {
    id: 'rocket',
    name: 'Rocket Rider',
    image: avatarImage('rocket'),
    emoji: '🚀',
    color: '#f97316' // orange
  },
  {
    id: 'alien',
    name: 'Galaxy Friend',
    image: avatarImage('alien'),
    emoji: '👽',
    color: '#22c55e' // green
  },
  {
    id: 'robot',
    name: 'Robo Pilot',
    image: avatarImage('robot'),
    emoji: '🤖',
    color: '#8b5cf6' // purple
  },
  {
    id: 'planet',
    name: 'Planet Hopper',
    image: avatarImage('planet'),
    emoji: '🪐',
    color: '#eab308' // yellow
  },
  {
    id: 'star',
    name: 'Star Chaser',
    image: avatarImage('star'),
    emoji: '⭐',
    color: '#fbbf24' // gold
  },
  {
    id: 'comet',
    name: 'Comet Cruiser',
    image: avatarImage('comet'),
    emoji: '☄️',
    color: '#06b6d4' // cyan
  },
  {
    id: 'moon',
    name: 'Moon Walker',
    image: avatarImage('moon'),
    emoji: '🌙',
    color: '#94a3b8' // gray
  },
  {
    id: 'ufo',
    name: 'UFO Captain',
    image: avatarImage('ufo'),
    emoji: '🛸',
    color: '#a855f7' // violet
  },
  {
    id: 'satellite',
    name: 'Signal Sender',
    image: avatarImage('satellite'),
    emoji: '🛰️',
    color: '#64748b' // slate
  },
  {
    id: 'telescope',
    name: 'Star Finder',
    image: avatarImage('telescope'),
    emoji: '🔭',
    color: '#0ea5e9' // sky
  }
];

export function getAvatarById(id: string): Avatar | undefined {
  return AVATARS.find(a => a.id === id);
}

export const DEFAULT_AVATAR = AVATARS[0];

// Interest options for profile creation (parent edit form)
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
