# 🚀 Space Readers

A space-mission-themed, gamified reading program for early readers (ages 8-9) who know letters and basic words but are too old for "baby" apps. Children become space-exploring heroes who help teach Zib, a friendly alien, to read English.

## 🌐 Live Demo

**Try it now:** https://actonrexburg.github.io/space-readers/

*(If this link doesn't work yet, see [Deployment](#deployment) section for setup instructions)*

## Features (Phase 1)

### For Children
- **Profile Picker**: Multiple child profiles on one device, tap-to-enter (no passwords)
- **Intro Video**: 65-second mission briefing introducing Zib and the reading adventure
- **Interest Picker**: 50 picture tiles for kids to pick what they love (dinosaurs, sharks, rockets, etc.) - used for AI story generation in Phase 2
- **Ship Bridge**: Home screen with mission flow, progress tracking, and a "Watch Mission Briefing" button to rewatch the intro
- **Decodable Stories**: 7 pre-written sci-fi stories with CVC words, digraphs, and sight words
- **Word Decoder**: Tap any word to see it broken into sound units (graphemes) with a slider that highlights each sound as you drag
- **Zib the Alien**: A cute character who "learns" words from the child
- **Gamification**: Fuel credits, star credits, ranks (Recruit → Admiral), planet unlocks

### For Parents/Teachers
- **Adult Gate**: Simple math problem to access settings
- **Progress Dashboard**: Per-child stats including:
  - Stories completed
  - Words decoded
  - Most-helped words (what they struggle with)
  - Reading time
  - Words taught to Zib
  - **Interests with emoji tiles** - view and edit a child's interests
- **Profile Management**: Edit names, avatars, interests

### Technical
- **Tron-Style Space UI**: Neon cyan/blue/magenta glow effects, animated parallax starfield, gold/orange reward accents
- **PWA**: Installable on any device
- **Touch-Friendly**: Large 48px+ touch targets, kid-friendly fonts (Fredoka, Lexend)
- **Performance**: Optimized for older Dell Chromebooks - CSS-only animations, no heavy blur filters
- **Accessibility**: Respects `prefers-reduced-motion`, high contrast text

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd space-readers

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npx tsc --noEmit
```

### Project Structure

```
space-readers/
├── src/
│   ├── components/      # Reusable React components
│   │   ├── AdultGate.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── ProfileCard.tsx
│   │   ├── ProfileForm.tsx
│   │   ├── ProgressDashboard.tsx
│   │   ├── Starfield.tsx
│   │   ├── StoryReader.tsx
│   │   ├── WordDecoder.tsx    # Core reading feature
│   │   └── Zib.tsx
│   ├── data/
│   │   ├── avatars.ts   # Avatar options
│   │   ├── missions.ts  # Mission definitions
│   │   └── stories.ts   # Pre-written decodable stories
│   ├── pages/
│   │   ├── Bridge.tsx   # Home screen
│   │   ├── Mission.tsx  # Mission/story flow
│   │   └── ProfilePicker.tsx
│   ├── services/
│   │   ├── api.ts       # Backend API (Phase 2 stub)
│   │   ├── audio.ts     # TTS abstraction
│   │   ├── phonics.ts   # Grapheme splitting
│   │   └── storage.ts   # Data persistence
│   ├── stores/
│   │   └── appStore.ts  # Zustand state management
│   ├── types/
│   │   └── index.ts     # TypeScript types
│   └── App.tsx
├── server/
│   └── api-stub.ts      # Phase 2 backend blueprint
└── public/
    └── rocket.svg       # App icon
```

## Data Architecture

The data layer is designed to scale from single-device localStorage to multi-tenant cloud:

```typescript
// Profiles support future school/classroom associations
interface Profile {
  id: string;
  name: string;
  avatarId: string;
  interests: string[];      // For AI story generation
  schoolId?: string;        // Phase 3
  classroomId?: string;     // Phase 3
}

// Stories have phonics metadata for AI generation
interface Story {
  id: string;
  paragraphs: StoryParagraph[];
  phonicsPatterns: string[];
  targetWords: string[];
  difficultyLevel: number;
  generatedFor?: {          // Phase 2 AI generation
    profileId: string;
    interests: string[];
    knownPatterns: string[];
  };
}
```

## Phase Roadmap

### Phase 1 ✅ (Current)
- [x] Profile picker with adult gate
- [x] Ship bridge home screen
- [x] 7 decodable sci-fi stories
- [x] Word decoder with slider
- [x] Web Speech API for TTS
- [x] Gamification (ranks, credits)
- [x] Parent/teacher dashboard
- [x] PWA installation

### Phase 2: AI Story Generation
- [ ] Backend server with LLM integration (GPT-4/Claude)
- [ ] Generate stories constrained to known phonics patterns
- [ ] Personalize stories using child's interests
- [ ] Phonics curriculum sequence with mastery tracking
- [ ] Prerecorded phoneme audio (replace Web Speech)
- [ ] Cloud sync for cross-device progress

**Technical Notes:**
- Stories generated via LLM with strict constraints
- Only words decodable with child's known patterns + sight words
- Backend handles API keys (never exposed to client)
- See `server/api-stub.ts` for endpoint blueprints

### Phase 3: Multi-Tenant & Classrooms
- [ ] Teacher accounts and dashboards
- [ ] School/classroom organization
- [ ] Student assignment and grouping
- [ ] Aggregate class progress reports
- [ ] Custom story libraries per school
- [ ] Export data for IEP documentation

**Data Model:**
```typescript
interface School { id, name, settings }
interface Classroom { id, schoolId, name, teacherId }
interface Teacher { id, email, schoolId, classroomIds }
```

### Phase 4: Reward Economy & Extended Content
- [ ] Star credits marketplace
- [ ] Unlock ship customizations
- [ ] More missions and planets
- [ ] Achievement badges
- [ ] Reading streaks
- [ ] Peer reading challenges

## Configuration

### Environment Variables

```env
# Phase 2+ API endpoint
VITE_API_URL=https://api.spacereaders.example.com

# Phase 2+ LLM API (server-side only, never client)
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
```

### PWA Icons

Replace the placeholder icons in `public/`:
- `pwa-192x192.png` (192x192)
- `pwa-512x512.png` (512x512)
- `apple-touch-icon.png` (180x180)

## Audio Architecture

The audio service is abstracted for easy swapping:

```typescript
interface AudioService {
  speakWord(word: string): Promise<void>;
  speakPhoneme(grapheme: Grapheme): Promise<void>;
  speakText(text: string): Promise<void>;
  stop(): void;
}
```

**Phase 1:** Web Speech API
**Phase 2:** Prerecorded phoneme audio or cloud TTS (Google, Amazon Polly)

## Phonics Coverage

Pre-written stories cover these patterns:
- CVC words (cat, dog, run)
- Digraphs (sh, ch, th, wh)
- CVCC/CCVC blends (stop, fast)
- Vowel teams (ea, ee, ai, ay)
- Magic e (cake, bike)
- R-controlled vowels (ar, or, er)

See `src/services/phonics.ts` for the grapheme splitting logic.

## Deployment

### GitHub Pages (Recommended for Testing)

The app auto-deploys to GitHub Pages when you push to `main`. To enable:

1. **Go to your repo Settings** → Pages
2. **Source**: Select "GitHub Actions"
3. **Push to main** or manually trigger the workflow

**The live URL will be:** `https://<your-username>.github.io/space-readers/`

The workflow is already configured in `.github/workflows/deploy.yml`.

### Manual Build for GitHub Pages

```bash
# Build with the correct base path
VITE_BASE_URL=/space-readers/ npm run build

# The dist/ folder is ready to deploy
```

### Static Hosting (Vercel, Netlify)

```bash
npm run build
# Deploy the `dist/` folder
```

For Vercel/Netlify, no base path modification is needed (they serve from root).

### Capacitor (Android App)

The app is designed to be wrappable with Capacitor for Android:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Space Readers" com.example.spacereaders
npx cap add android
npm run build
npx cap sync
npx cap open android
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

MIT License - See LICENSE file for details.

## Acknowledgments

- Inspired by [reading.com](https://reading.com)'s word decoder approach
- Profile picker pattern from Khan Academy Kids
- Phonics curriculum based on Orton-Gillingham principles
