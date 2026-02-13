# 🎵 Spotify Quiz Integration - Complete Implementation Plan

> **Version:** 2.0 (Final)  
> **Date:** February 13, 2026  
> **Status:** Ready for Implementation

---

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Question Types](#3-question-types)
4. [Data Models](#4-data-models)
5. [Quiz Builder UI](#5-quiz-builder-ui)
6. [Host Panel - Audio Controls](#6-host-panel---audio-controls)
7. [Display Screen](#7-display-screen)
8. [Player Mobile UI](#8-player-mobile-ui)
9. [WebSocket Events](#9-websocket-events)
10. [API Endpoints](#10-api-endpoints)
11. [Implementation Phases](#11-implementation-phases)
12. [Technical Considerations](#12-technical-considerations)

---

## 1. Executive Summary

### 1.1 Goal
Implement Spotify-powered music quiz questions for PartyQuiz, enabling pub quiz and Hitster-style gameplay where players guess song titles, artists, and release years.

### 1.2 Core Principles

| Principle | Decision |
|-----------|----------|
| **Primary Playback** | Spotify Web Playback SDK on Display device |
| **Fallback** | Spotify Connect to external speaker |
| **Preview URLs** | Treat as "nice-to-have", not core dependency |
| **Account Model** | 1 Spotify Premium account = 1 active stream |
| **Device Setup** | Display runs on real Chrome (mini-PC/laptop via HDMI) |

### 1.3 What's NOT Included
- ❌ Mini-games (MUSIC_QUEUE, MUSIC_BATTLE) - future scope
- ❌ Lyrics from Spotify API (not available)
- ❌ Multi-device simultaneous full-track playback (Spotify limitation)

---

## 2. Architecture Overview

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PARTYQUIZ SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   BUILDER    │     │    HOST      │     │   DISPLAY    │                │
│  │  (Next.js)   │     │  (Next.js)   │     │  (Next.js)   │                │
│  │              │     │              │     │              │                │
│  │ • Search     │     │ • Controls   │     │ • SDK Init   │                │
│  │ • Preview    │     │ • Play/Pause │     │ • Playback   │                │
│  │ • Fragment   │     │ • Volume     │     │ • Visual     │                │
│  │ • Save       │     │ • Device     │     │ • Sync       │                │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                │
│         │                    │                    │                        │
│         │              WebSocket (Socket.IO)      │                        │
│         └────────────────────┼────────────────────┘                        │
│                              │                                             │
│                    ┌─────────▼─────────┐                                   │
│                    │    WS SERVER      │                                   │
│                    │   (apps/ws)       │                                   │
│                    │                   │                                   │
│                    │ • Session state   │                                   │
│                    │ • Playback ctrl   │                                   │
│                    │ • Device lock     │                                   │
│                    └─────────┬─────────┘                                   │
│                              │                                             │
│              ┌───────────────┼───────────────┐                             │
│              │               │               │                             │
│        ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐                       │
│        │  Prisma   │   │   Redis   │   │ Spotify   │                       │
│        │  (DB)     │   │  (State)  │   │ Web API   │                       │
│        └───────────┘   └───────────┘   └───────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Playback Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  HOST   │───▶│   WS    │───▶│ DISPLAY │───▶│ SPOTIFY │
│ "Play"  │    │ SERVER  │    │   SDK   │    │  API    │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │
     │  PLAY_MUSIC  │              │              │
     │─────────────▶│  SPOTIFY_PLAY│              │
     │              │─────────────▶│   play()     │
     │              │              │─────────────▶│
     │              │              │              │
     │              │   STATE_UPDATE (500ms)      │
     │              │◀─────────────│              │
     │              │              │              │
     │   PLAYBACK_SYNC             │              │
     │◀─────────────│─────────────▶│              │
     │  (progress)  │  (all clients)              │
```

### 2.3 Device Setup Requirements

| Component | Requirement | Notes |
|-----------|-------------|-------|
| **Display Device** | Chrome 88+ on mini-PC/laptop | Connected to TV via HDMI |
| **Host Device** | Any modern browser | Phone/tablet/laptop |
| **Spotify Account** | Premium required | For Web Playback SDK |
| **Network** | Same network preferred | Lower latency |

---

## 3. Question Types

### 3.1 Supported Types

| Type | Description | Answer Format | Difficulty |
|------|-------------|---------------|------------|
| `MUSIC_GUESS_TITLE` | Guess the song title | Text input / Multiple choice | ⭐⭐ |
| `MUSIC_GUESS_ARTIST` | Guess the artist/band | Text input / Multiple choice | ⭐⭐ |
| `MUSIC_GUESS_YEAR` | Guess the release year | Year selector / Range | ⭐⭐⭐ |
| `MUSIC_INTRO_CHALLENGE` | Guess from short intro | Text input | ⭐⭐⭐⭐ |
| `MUSIC_FINISH_THE_LINE` | Complete the lyric line | Multiple choice | ⭐⭐⭐ |

### 3.2 Detailed Type Specifications

#### 3.2.1 MUSIC_GUESS_TITLE
```typescript
{
  questionType: 'MUSIC_GUESS_TITLE',
  questionText: 'What is the name of this song?', // Auto-generated or custom
  spotify: {
    trackId: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
    // ... track details
  },
  answerMode: 'OPEN_TEXT' | 'MULTIPLE_CHOICE',
  correctAnswer: 'Bohemian Rhapsody',
  alternatives: ['bohemian', 'bohemian rapsody'], // Fuzzy match options
  multipleChoiceOptions: ['Bohemian Rhapsody', 'We Will Rock You', 'Killer Queen', 'Radio Ga Ga'],
  playDuration: 15000, // Play 15 seconds
  hints: {
    afterSeconds: 10,
    showArtist: true,
    showFirstLetter: false,
  }
}
```

#### 3.2.2 MUSIC_GUESS_ARTIST
```typescript
{
  questionType: 'MUSIC_GUESS_ARTIST',
  questionText: 'Who performs this song?',
  spotify: { /* track details */ },
  answerMode: 'OPEN_TEXT' | 'MULTIPLE_CHOICE',
  correctAnswer: 'Queen',
  alternatives: ['queen band', 'freddie mercury'],
  multipleChoiceOptions: ['Queen', 'The Beatles', 'Led Zeppelin', 'Pink Floyd'],
  playDuration: 15000,
}
```

#### 3.2.3 MUSIC_GUESS_YEAR
```typescript
{
  questionType: 'MUSIC_GUESS_YEAR',
  questionText: 'In what year was this song released?',
  spotify: { /* track details */ },
  answerMode: 'YEAR_SELECTOR' | 'YEAR_RANGE',
  correctAnswer: 1975,
  scoring: {
    exact: 100,        // Exact year = 100 points
    offByOne: 75,      // ±1 year = 75 points
    offByTwo: 50,      // ±2 years = 50 points
    offByThree: 25,    // ±3 years = 25 points
  },
  yearRange: { min: 1950, max: 2025 }, // For year selector
}
```

#### 3.2.4 MUSIC_INTRO_CHALLENGE
```typescript
{
  questionType: 'MUSIC_INTRO_CHALLENGE',
  questionText: 'Name this song from the intro!',
  spotify: { /* track details */ },
  introMode: '1_SECOND' | '3_SECONDS' | '5_SECONDS' | 'PROGRESSIVE',
  progressiveSettings: {
    attempts: [
      { duration: 1000, points: 100 },
      { duration: 3000, points: 75 },
      { duration: 5000, points: 50 },
      { duration: 10000, points: 25 },
    ],
  },
  answerMode: 'BUZZER', // First to buzz and answer correctly
}
```

#### 3.2.5 MUSIC_FINISH_THE_LINE
```typescript
{
  questionType: 'MUSIC_FINISH_THE_LINE',
  questionText: 'Complete the lyric...',
  lyricFragment: 'Is this the real life? Is this just...', // Short, fair use
  spotify: { /* track for context/audio */ },
  answerMode: 'MULTIPLE_CHOICE',
  correctAnswer: 'fantasy',
  multipleChoiceOptions: ['fantasy', 'a dream', 'illusion', 'reality'],
  playAudio: false, // Optional: play song segment for context
}
```

### 3.3 Answer Modes

| Mode | UI Component | Use Case |
|------|--------------|----------|
| `OPEN_TEXT` | Text input with fuzzy matching | Title/Artist guessing |
| `MULTIPLE_CHOICE` | 4 option buttons | Easier mode, party setting |
| `YEAR_SELECTOR` | Slider or number input | Year guessing |
| `YEAR_RANGE` | Decade buttons | Simplified year guessing |
| `BUZZER` | Tap to buzz, then answer | Competitive intro challenge |

---

## 4. Data Models

### 4.1 Prisma Schema Extensions

```prisma
// Add to LiveSession model
model LiveSession {
  // ... existing fields ...
  
  // ═══════════════════════════════════════════════════════════
  // SPOTIFY AUDIO SETTINGS
  // ═══════════════════════════════════════════════════════════
  
  // Display device (locked for this session)
  spotifyDeviceId       String?   // Spotify device ID
  spotifyDeviceName     String?   // "PartyQuiz Display"
  spotifyDeviceLastSeen DateTime? // Last heartbeat
  spotifyDeviceLocked   Boolean   @default(false)
  
  // Audio preferences
  playbackStrategy      String    @default("SDK_DEVICE") 
                                  // SDK_DEVICE | SPOTIFY_CONNECT | PREVIEW_ONLY
  audioVolume           Int       @default(80) // 0-100
  stopMode              String    @default("FADE") // PAUSE | FADE
  fadeOutMs             Int       @default(500) // 300-1000ms
}
```

### 4.2 TypeScript Types

```typescript
// packages/shared/src/spotify-types.ts

// ═══════════════════════════════════════════════════════════
// SPOTIFY TRACK CONFIG (stored in Question.mediaConfig)
// ═══════════════════════════════════════════════════════════

export interface SpotifyTrackConfig {
  // Track identification
  trackId: string;              // Spotify track ID
  trackUri: string;             // spotify:track:xxx
  
  // Track metadata
  trackName: string;
  artistName: string;
  artistId: string;
  albumName: string;
  albumArt: string;             // 300x300 image URL
  albumArtLarge: string;        // 640x640 image URL
  durationMs: number;           // Full track duration
  releaseYear: number;
  isrc?: string;                // International Standard Recording Code
  
  // Fragment settings
  startPositionMs: number;      // Where to start playback (0 = beginning)
  playDurationMs: number;       // How long to play (5000-30000)
  
  // Preview availability (NOT guaranteed!)
  previewUrl: string | null;    // 30s preview URL (often null)
  previewAvailable: boolean;    // false = show warning in builder
  
  // Playback behavior overrides
  stopMode?: 'pause' | 'fade';  // Override session default
  fadeOutMs?: number;           // Override session default
  revealContinuesPlayback?: boolean; // Continue after reveal?
}

// ═══════════════════════════════════════════════════════════
// MUSIC QUESTION CONFIG (stored in Question.config)
// ═══════════════════════════════════════════════════════════

export interface MusicQuestionConfig {
  // Question type specific
  questionType: MusicQuestionType;
  
  // Answer configuration
  answerMode: 'OPEN_TEXT' | 'MULTIPLE_CHOICE' | 'YEAR_SELECTOR' | 'YEAR_RANGE' | 'BUZZER';
  correctAnswer: string | number;
  alternatives?: string[];      // Acceptable variations
  multipleChoiceOptions?: string[];
  
  // Year question specific
  yearScoring?: {
    exact: number;
    offByOne: number;
    offByTwo: number;
    offByThree: number;
  };
  yearRange?: { min: number; max: number };
  
  // Intro challenge specific
  introMode?: '1_SECOND' | '3_SECONDS' | '5_SECONDS' | 'PROGRESSIVE';
  progressiveSettings?: {
    attempts: Array<{ duration: number; points: number }>;
  };
  
  // Hints
  hints?: {
    afterSeconds?: number;
    showArtist?: boolean;
    showFirstLetter?: boolean;
    showDecade?: boolean;
  };
  
  // Finish the line specific
  lyricFragment?: string;
  playAudioWithLyric?: boolean;
}

export type MusicQuestionType = 
  | 'MUSIC_GUESS_TITLE'
  | 'MUSIC_GUESS_ARTIST'
  | 'MUSIC_GUESS_YEAR'
  | 'MUSIC_INTRO_CHALLENGE'
  | 'MUSIC_FINISH_THE_LINE';

// ═══════════════════════════════════════════════════════════
// SESSION AUDIO SETTINGS
// ═══════════════════════════════════════════════════════════

export interface SessionAudioSettings {
  // Device
  spotifyDeviceId: string | null;
  spotifyDeviceName: string | null;
  spotifyDeviceLocked: boolean;
  
  // Strategy
  playbackStrategy: 'SDK_DEVICE' | 'SPOTIFY_CONNECT' | 'PREVIEW_ONLY';
  
  // Audio
  volume: number;               // 0-100
  stopMode: 'PAUSE' | 'FADE';
  fadeOutMs: number;            // 300-1000
}

// ═══════════════════════════════════════════════════════════
// DEVICE REGISTRATION
// ═══════════════════════════════════════════════════════════

export interface AudioDeviceCapabilities {
  webPlaybackSDK: boolean;      // Can use Spotify Web Playback SDK
  spotifyConnect: boolean;      // Can receive Spotify Connect
  previewPlayback: boolean;     // Can play preview URLs (HTML5 Audio)
  browserName: string;          // Chrome, Firefox, Safari, etc.
  browserVersion: string;
  platform: string;             // Windows, macOS, Linux, Android, etc.
}

export interface RegisteredAudioDevice {
  deviceId: string;
  deviceName: string;
  capabilities: AudioDeviceCapabilities;
  registeredAt: number;
  lastSeenAt: number;
  isActive: boolean;
  isLocked: boolean;
}

// ═══════════════════════════════════════════════════════════
// PLAYBACK STATE
// ═══════════════════════════════════════════════════════════

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  trackId: string | null;
  positionMs: number;
  durationMs: number;
  volume: number;
  deviceId: string | null;
  timestamp: number;            // Server timestamp for sync
}
```

### 4.3 Redis Keys

```typescript
// Session audio state
`session:${code}:audio` = {
  deviceId: string,
  deviceName: string,
  deviceLocked: boolean,
  playbackStrategy: string,
  volume: number,
  stopMode: string,
  fadeOutMs: number,
}

// Current playback state
`session:${code}:playback` = {
  isPlaying: boolean,
  trackId: string,
  startedAt: number,      // Unix timestamp
  positionMs: number,
  durationMs: number,
  endsAt: number,         // When playback should stop
}

// Device heartbeat
`session:${code}:device:heartbeat` = timestamp
```

---

## 5. Quiz Builder UI

### 5.1 Music Question Builder Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ADD QUESTION                                                    [×]       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Question Type:  [▼ Music - Guess Title    ]                               │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  🎵 SELECT TRACK                                                      │ │
│  │                                                                       │ │
│  │  Search: [bohemian rhapsody________________] [🔍]                     │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  🎵 Bohemian Rhapsody                              [▶ Preview]  │ │ │
│  │  │  Queen • A Night at the Opera • 1975                           │ │ │
│  │  │  ⚠️ Preview: Uncertain (may not be available)                   │ │ │
│  │  │  Duration: 5:55                                    [+ Select]  │ │ │
│  │  ├─────────────────────────────────────────────────────────────────┤ │ │
│  │  │  🎵 Bohemian Rhapsody (Remastered 2011)            [▶ Preview]  │ │ │
│  │  │  Queen • Greatest Hits • 2011                                  │ │ │
│  │  │  ✅ Preview: Available                                          │ │ │
│  │  │  Duration: 5:55                                    [+ Select]  │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Track Selected - Fragment Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MUSIC QUESTION - GUESS TITLE                                    [×]       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  ╭──────╮                                                          │    │
│  │  │ 🎵   │  Bohemian Rhapsody                                       │    │
│  │  │      │  Queen • 1975                                            │    │
│  │  ╰──────╯  5:55                                     [✓ Selected]   │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│  AUDIO FRAGMENT                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Start Position:                                                            │
│  ├────────●────────────────────────────────────────────────────────────┤   │
│  0:00    0:45                                                     5:55     │
│                                                                             │
│  Play Duration:  [▼ 15 seconds ]                                           │
│                  └─ 5s │ 10s │ 15s │ 20s │ 30s │ Custom                    │
│                                                                             │
│  Fragment Preview:  0:45 → 1:00  (15 sec)                                  │
│                                                                             │
│  [▶ Play Fragment]  [⟳ Reset]                                              │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│  ANSWER SETTINGS                                                            │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Answer Mode:  (•) Open Text    ( ) Multiple Choice                        │
│                                                                             │
│  Correct Answer: [Bohemian Rhapsody_____________] (auto-filled)            │
│                                                                             │
│  Accept Variations:                                                         │
│  [✓] Ignore case/accents                                                   │
│  [✓] Allow "bohemian"                                                      │
│  [+] Add custom variation                                                  │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│  HINTS (Optional)                                                           │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  [ ] Show artist after _____ seconds                                       │
│  [ ] Show first letter of title                                            │
│  [ ] Show release decade                                                   │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│  PLAYBACK BEHAVIOR                                                          │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Stop Mode:  (•) Fade out    ( ) Abrupt pause                              │
│  Fade Duration: [▼ 500ms ]                                                 │
│                                                                             │
│  After Reveal:  [✓] Continue playing song                                  │
│                                                                             │
│                                          [Cancel]  [Save Question]         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Multiple Choice Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ANSWER SETTINGS - Multiple Choice                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Answer Mode:  ( ) Open Text    (•) Multiple Choice                        │
│                                                                             │
│  Options (4 required):                                                      │
│                                                                             │
│  ✓ Correct │ [Bohemian Rhapsody_____________________]                      │
│            │ [We Will Rock You_______________________]                      │
│            │ [Killer Queen___________________________]                      │
│            │ [Radio Ga Ga____________________________]                      │
│                                                                             │
│  [🎲 Auto-generate distractors]  ← Uses same artist/era for plausibility   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Year Question Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MUSIC QUESTION - GUESS YEAR                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Correct Year: [1975] (from Spotify metadata)                              │
│                                                                             │
│  Answer Mode:                                                               │
│  (•) Year Selector (slider/input)                                          │
│  ( ) Decade Buttons (70s, 80s, 90s, etc.)                                  │
│                                                                             │
│  Year Range:  From [1950]  To [2025]                                       │
│                                                                             │
│  Scoring:                                                                   │
│  ┌──────────────────────────────────────┐                                  │
│  │  Exact year (1975)     │  100 pts   │                                  │
│  │  ±1 year (1974, 1976)  │   75 pts   │                                  │
│  │  ±2 years              │   50 pts   │                                  │
│  │  ±3 years              │   25 pts   │                                  │
│  │  More than ±3          │    0 pts   │                                  │
│  └──────────────────────────────────────┘                                  │
│                                                                             │
│  Hints:                                                                     │
│  [ ] Show decade after _____ seconds                                       │
│  [ ] Show "before/after [year]" hint                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.5 Intro Challenge Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MUSIC QUESTION - INTRO CHALLENGE                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Intro Mode:                                                                │
│  ( ) 1 Second Intro     ← Hardest, most points                             │
│  (•) 3 Second Intro                                                         │
│  ( ) 5 Second Intro                                                         │
│  ( ) Progressive        ← Multiple attempts, decreasing points             │
│                                                                             │
│  Progressive Settings:                                                      │
│  ┌────────────────────────────────────────────────────┐                    │
│  │  Attempt 1:  1 sec intro  →  100 points           │                    │
│  │  Attempt 2:  3 sec intro  →   75 points           │                    │
│  │  Attempt 3:  5 sec intro  →   50 points           │                    │
│  │  Attempt 4: 10 sec intro  →   25 points           │                    │
│  └────────────────────────────────────────────────────┘                    │
│                                                                             │
│  Answer Mode:                                                               │
│  (•) Buzzer (first to answer)                                              │
│  ( ) Simultaneous (everyone answers)                                        │
│                                                                             │
│  Buzzer Settings:                                                           │
│  Time to answer after buzz: [10] seconds                                   │
│  Penalty for wrong buzz: [-5] points                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Host Panel - Audio Controls

### 6.1 Session Audio Setup (Pre-game)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎵 AUDIO SETUP                                              Session: ABCD │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│  SPOTIFY CONNECTION                                                         │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Account: ● Connected as "edwin_partyquiz"                                 │
│           Premium Account ✓                                                │
│                                                                             │
│  [Disconnect]  [Refresh Token]                                             │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│  DISPLAY DEVICE                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Status:  ● Device Connected                                               │
│  Name:    PartyQuiz Display (Chrome)                                       │
│  Last Seen: 2 seconds ago                                                  │
│                                                                             │
│  Capabilities:                                                              │
│  ✅ Web Playback SDK                                                        │
│  ✅ Preview Playback                                                        │
│  ✅ Spotify Connect                                                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ Device Lock                                                      │   │
│  │  Lock this device as the audio output for this session.             │   │
│  │  Other Spotify apps won't be able to take over playback.            │   │
│  │                                                                     │   │
│  │  [🔒 Lock Device]                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│  AUDIO SETTINGS                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Playback Strategy:                                                         │
│  (•) SDK Device (Display browser)     ← Recommended                        │
│  ( ) Spotify Connect (external)       ← Use existing speaker               │
│  ( ) Preview Only (multi-device)      ← 30s clips, experimental            │
│                                                                             │
│  Volume:  [──────────●────] 80%                                            │
│                                                                             │
│  Stop Mode:                                                                 │
│  (•) Fade out (500ms)                                                      │
│  ( ) Abrupt pause                                                          │
│                                                                             │
│  Fade Duration:  [▼ 500ms ]                                                │
│                                                                             │
│                                                    [Save Settings]         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Live Playback Controls (During Game)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎵 NOW PLAYING                                              [≡ Collapse]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ╭────────╮                                                          │  │
│  │  │        │   Bohemian Rhapsody                                      │  │
│  │  │  🎵    │   Queen • 1975                                           │  │
│  │  │        │                                                          │  │
│  │  ╰────────╯   Fragment: 0:45 → 1:00                                  │  │
│  │               ├────────●─────────────────────────────────────┤       │  │
│  │              0:47                                           1:00     │  │
│  │                                                                      │  │
│  │                                                                      │  │
│  │     [⏮]     [⏸ PAUSE]     [⏭]     [⏹ STOP]                         │  │
│  │    restart     playing     skip      end                             │  │
│  │                                                                      │  │
│  │                                                                      │  │
│  │  Volume: [────────●──────] 80%          Device: 🔒 Display (locked) │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  DEVICE STATUS                                                       │  │
│  │  ● Active on: PartyQuiz Display                                      │  │
│  │  ⏱ Latency: ~50ms                                                    │  │
│  │                                                                      │  │
│  │  [↻ Reclaim Device]  ← Use if another app took over                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Device Takeover Warning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠️ DEVICE TAKEOVER DETECTED                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Another device has taken over Spotify playback:                           │
│                                                                             │
│  Previous: PartyQuiz Display (Chrome)                                      │
│  Current:  Edwin's iPhone                                                  │
│                                                                             │
│  To continue playing music questions, reclaim the display device.          │
│                                                                             │
│                  [↻ Reclaim Display]     [Continue Without Audio]          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Host Controls State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HOST PLAYBACK STATES                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│     ┌──────────┐                                                           │
│     │  IDLE    │ ◄─────────────────────────────────────────┐               │
│     └────┬─────┘                                           │               │
│          │                                                 │               │
│          │ Question starts                                 │               │
│          │ (music question)                                │               │
│          ▼                                                 │               │
│     ┌──────────┐        ┌──────────┐                      │               │
│     │  READY   │───────▶│ PLAYING  │──────────────────────┤               │
│     └──────────┘  Play  └────┬─────┘   Duration ends /    │               │
│          │               │   │         Host stops         │               │
│          │               │   │                            │               │
│     Skip │               │   │ Host pauses                │               │
│          │               │   ▼                            │               │
│          │          ┌──────────┐                          │               │
│          │          │  PAUSED  │──────────────────────────┘               │
│          │          └────┬─────┘   Host resumes → PLAYING                 │
│          │               │                                                 │
│          └───────────────┴─────────────▶ IDLE (skip)                      │
│                                                                             │
│  Valid Host Actions per State:                                             │
│  ─────────────────────────────                                             │
│  IDLE:    (no audio controls)                                              │
│  READY:   [▶ Play] [⏭ Skip]                                               │
│  PLAYING: [⏸ Pause] [⏹ Stop] [⏭ Skip] [🔊 Volume]                         │
│  PAUSED:  [▶ Resume] [⏹ Stop] [⏭ Skip]                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Display Screen

### 7.1 Music Question - Playing State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                           QUESTION 5 OF 12                                  │
│                                                                             │
│                    ┌───────────────────────────┐                           │
│                    │                           │                           │
│                    │     ╭───────────────╮     │                           │
│                    │     │               │     │                           │
│                    │     │   [BLURRED    │     │                           │
│                    │     │    ALBUM      │     │                           │
│                    │     │    ART]       │     │                           │
│                    │     │               │     │                           │
│                    │     ╰───────────────╯     │                           │
│                    │                           │                           │
│                    │   ♫ ▁ ▂ ▃ ▅ ▆ ▇ █ ▇ ▅ ▃  │  ← Audio visualizer      │
│                    │                           │                           │
│                    └───────────────────────────┘                           │
│                                                                             │
│                         🎵 NAME THIS SONG! 🎵                               │
│                                                                             │
│                    ├────────●───────────────────┤                          │
│                   0:00     0:08              0:15                          │
│                                                                             │
│                           ⏱ 0:22 remaining                                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         PLAYERS ANSWERED                            │   │
│  │                                                                     │   │
│  │   ✓ Player 1    ✓ Player 2    ○ Player 3    ○ Player 4             │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Music Question - Reveal State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                           QUESTION 5 OF 12                                  │
│                                                                             │
│                    ┌───────────────────────────┐                           │
│                    │                           │                           │
│                    │     ╭───────────────╮     │                           │
│                    │     │               │     │                           │
│                    │     │    CLEAR      │     │  ← No longer blurred      │
│                    │     │    ALBUM      │     │                           │
│                    │     │    ART        │     │                           │
│                    │     │               │     │                           │
│                    │     ╰───────────────╯     │                           │
│                    │                           │                           │
│                    │   ♫ ▁ ▂ ▃ ▅ ▆ ▇ █ ▇ ▅ ▃  │  ← Still playing         │
│                    │                           │                           │
│                    └───────────────────────────┘                           │
│                                                                             │
│                       ✨ BOHEMIAN RHAPSODY ✨                               │
│                             by Queen                                        │
│                              1975                                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          SCOREBOARD                                 │   │
│  │                                                                     │   │
│  │   🥇 Player 2  (+100)    🥈 Player 1  (+75)    ❌ Player 3  (0)    │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Display - Device Registration Overlay

When display first loads:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                      🔊 REGISTERING AUDIO DEVICE                           │
│                                                                             │
│                    ┌───────────────────────────┐                           │
│                    │                           │                           │
│                    │     Initializing          │                           │
│                    │     Spotify Web           │                           │
│                    │     Playback SDK...       │                           │
│                    │                           │                           │
│                    │     [████████░░░] 80%     │                           │
│                    │                           │                           │
│                    └───────────────────────────┘                           │
│                                                                             │
│                    Status: Connecting to Spotify                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.4 Display - Device Not Supported

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                      ⚠️ AUDIO DEVICE ISSUE                                 │
│                                                                             │
│                    ┌───────────────────────────┐                           │
│                    │                           │                           │
│                    │  This browser does not    │                           │
│                    │  support Spotify Web      │                           │
│                    │  Playback SDK.            │                           │
│                    │                           │                           │
│                    │  Detected: Samsung TV     │                           │
│                    │  Browser (Tizen)          │                           │
│                    │                           │                           │
│                    └───────────────────────────┘                           │
│                                                                             │
│                    RECOMMENDED SOLUTIONS:                                  │
│                                                                             │
│                    1. Connect a laptop via HDMI                            │
│                    2. Use a Chromecast with Google TV                      │
│                    3. Use an Android TV box                                │
│                                                                             │
│                    [Continue Without Music]                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Player Mobile UI

### 8.1 Music Question - Answer Input (Open Text)

```
┌─────────────────────────┐
│        QUESTION 5       │
│        ⏱ 0:22          │
├─────────────────────────┤
│                         │
│   🎵 NAME THIS SONG!    │
│                         │
│   ╭─────────────────╮   │
│   │  [BLURRED ART]  │   │
│   ╰─────────────────╯   │
│                         │
│   ♫ Playing...          │
│   ├──●────────────┤     │
│   0:08          0:15    │
│                         │
├─────────────────────────┤
│                         │
│  Your Answer:           │
│  ┌─────────────────┐    │
│  │ bohemian rhaps  │    │
│  └─────────────────┘    │
│                         │
│  [    SUBMIT ✓    ]     │
│                         │
└─────────────────────────┘
```

### 8.2 Music Question - Multiple Choice

```
┌─────────────────────────┐
│        QUESTION 5       │
│        ⏱ 0:22          │
├─────────────────────────┤
│                         │
│   🎵 NAME THIS SONG!    │
│                         │
│   ╭─────────────────╮   │
│   │  [BLURRED ART]  │   │
│   ╰─────────────────╯   │
│                         │
├─────────────────────────┤
│                         │
│  ┌───────────────────┐  │
│  │ A. Bohemian       │  │
│  │    Rhapsody       │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ B. We Will Rock   │  │
│  │    You            │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ C. Killer Queen   │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ D. Radio Ga Ga    │  │
│  └───────────────────┘  │
│                         │
└─────────────────────────┘
```

### 8.3 Music Question - Year Selector

```
┌─────────────────────────┐
│        QUESTION 5       │
│        ⏱ 0:22          │
├─────────────────────────┤
│                         │
│   📅 WHAT YEAR?         │
│                         │
│   ╭─────────────────╮   │
│   │  [ALBUM ART]    │   │
│   │  (clear)        │   │
│   ╰─────────────────╯   │
│                         │
│   "Bohemian Rhapsody"   │
│   by Queen              │
│                         │
├─────────────────────────┤
│                         │
│   ┌─────────────────┐   │
│   │      1975       │   │
│   └─────────────────┘   │
│                         │
│   ├──────────●──────┤   │
│  1950              2025 │
│                         │
│   [    SUBMIT ✓    ]    │
│                         │
└─────────────────────────┘
```

### 8.4 Music Question - Buzzer Mode

```
┌─────────────────────────┐
│    INTRO CHALLENGE      │
│      3 SECOND INTRO     │
├─────────────────────────┤
│                         │
│   🎵 LISTEN...          │
│                         │
│   ╭─────────────────╮   │
│   │                 │   │
│   │   ♫ ▁ ▂ ▃ ▅ ▆   │   │
│   │                 │   │
│   ╰─────────────────╯   │
│                         │
│   First to buzz wins!   │
│                         │
├─────────────────────────┤
│                         │
│                         │
│   ╭─────────────────╮   │
│   │                 │   │
│   │                 │   │
│   │   🔔 BUZZ!      │   │
│   │                 │   │
│   │                 │   │
│   ╰─────────────────╯   │
│                         │
│   Tap to answer first   │
│                         │
└─────────────────────────┘
```

### 8.5 Player - After Buzzing

```
┌─────────────────────────┐
│   ✓ YOU BUZZED FIRST!   │
│      ⏱ 0:08 to answer   │
├─────────────────────────┤
│                         │
│   What's the song?      │
│                         │
│  ┌─────────────────┐    │
│  │ bohemian rhaps  │    │
│  └─────────────────┘    │
│                         │
│  [    SUBMIT ✓    ]     │
│                         │
│  ─────────────────────  │
│                         │
│  Worth: 100 points      │
│  Wrong answer: -5 pts   │
│                         │
└─────────────────────────┘
```

---

## 9. WebSocket Events

### 9.1 Device Management Events

```typescript
// ═══════════════════════════════════════════════════════════
// DEVICE REGISTRATION (Display → Server)
// ═══════════════════════════════════════════════════════════

interface RegisterAudioDeviceEvent {
  type: 'REGISTER_AUDIO_DEVICE';
  payload: {
    sessionCode: string;
    spotifyDeviceId: string;
    deviceName: string;
    capabilities: {
      webPlaybackSDK: boolean;
      spotifyConnect: boolean;
      previewPlayback: boolean;
      browserName: string;
      browserVersion: string;
      platform: string;
    };
  };
}

// ═══════════════════════════════════════════════════════════
// DEVICE STATUS (Server → Host)
// ═══════════════════════════════════════════════════════════

interface AudioDeviceStatusEvent {
  type: 'AUDIO_DEVICE_STATUS';
  payload: {
    deviceId: string | null;
    deviceName: string | null;
    isConnected: boolean;
    isActive: boolean;
    isLocked: boolean;
    lastSeenAt: number;
    capabilities: AudioDeviceCapabilities | null;
    takenOverBy?: string; // If another device took over
  };
}

// ═══════════════════════════════════════════════════════════
// DEVICE LOCK (Host → Server)
// ═══════════════════════════════════════════════════════════

interface LockAudioDeviceEvent {
  type: 'LOCK_AUDIO_DEVICE';
  payload: {
    sessionCode: string;
    lock: boolean; // true = lock, false = unlock
  };
}

// ═══════════════════════════════════════════════════════════
// RECLAIM DEVICE (Host → Server → Display)
// ═══════════════════════════════════════════════════════════

interface ReclaimAudioDeviceEvent {
  type: 'RECLAIM_AUDIO_DEVICE';
  payload: {
    sessionCode: string;
  };
}

// Server forwards to display, which calls Spotify's transfer_playback
```

### 9.2 Playback Control Events

```typescript
// ═══════════════════════════════════════════════════════════
// PLAY (Server → Display)
// ═══════════════════════════════════════════════════════════

interface SpotifyPlayEvent {
  type: 'SPOTIFY_PLAY';
  payload: {
    trackUri: string;           // spotify:track:xxx
    startPositionMs: number;    // Where to start
    playDurationMs: number;     // How long to play
    volume: number;             // 0-100
    fadeOutMs: number;          // Fade duration at end (0 = no fade)
    questionId: string;         // For correlation
  };
}

// ═══════════════════════════════════════════════════════════
// PAUSE (Server → Display)
// ═══════════════════════════════════════════════════════════

interface SpotifyPauseEvent {
  type: 'SPOTIFY_PAUSE';
  payload: {
    immediate: boolean;         // true = instant, false = respect fadeOut
    fadeOutMs?: number;
  };
}

// ═══════════════════════════════════════════════════════════
// RESUME (Server → Display)
// ═══════════════════════════════════════════════════════════

interface SpotifyResumeEvent {
  type: 'SPOTIFY_RESUME';
  payload: {
    volume?: number;            // Optional volume change
  };
}

// ═══════════════════════════════════════════════════════════
// STOP (Server → Display)
// ═══════════════════════════════════════════════════════════

interface SpotifyStopEvent {
  type: 'SPOTIFY_STOP';
  payload: {
    fadeOutMs?: number;
  };
}

// ═══════════════════════════════════════════════════════════
// VOLUME (Server → Display)
// ═══════════════════════════════════════════════════════════

interface SpotifyVolumeEvent {
  type: 'SPOTIFY_VOLUME';
  payload: {
    volume: number;             // 0-100
    fadeDuration?: number;      // Smooth transition
  };
}

// ═══════════════════════════════════════════════════════════
// SEEK (Server → Display)
// ═══════════════════════════════════════════════════════════

interface SpotifySeekEvent {
  type: 'SPOTIFY_SEEK';
  payload: {
    positionMs: number;
  };
}
```

### 9.3 Playback State Events

```typescript
// ═══════════════════════════════════════════════════════════
// STATE UPDATE (Display → Server, every 500ms while playing)
// ═══════════════════════════════════════════════════════════

interface PlaybackStateUpdateEvent {
  type: 'PLAYBACK_STATE_UPDATE';
  payload: {
    sessionCode: string;
    isPlaying: boolean;
    isPaused: boolean;
    trackId: string;
    positionMs: number;
    durationMs: number;
    volume: number;
    timestamp: number;          // Client timestamp
  };
}

// ═══════════════════════════════════════════════════════════
// SYNC BROADCAST (Server → All Clients)
// ═══════════════════════════════════════════════════════════

interface PlaybackSyncEvent {
  type: 'PLAYBACK_SYNC';
  payload: {
    isPlaying: boolean;
    positionMs: number;
    expectedEndMs: number;      // When playback should end
    serverTimestamp: number;
  };
}

// ═══════════════════════════════════════════════════════════
// PLAYBACK ENDED (Display → Server → All)
// ═══════════════════════════════════════════════════════════

interface PlaybackEndedEvent {
  type: 'PLAYBACK_ENDED';
  payload: {
    sessionCode: string;
    questionId: string;
    reason: 'DURATION_REACHED' | 'HOST_STOPPED' | 'TRACK_ENDED' | 'ERROR';
  };
}
```

### 9.4 Quiz Flow Events

```typescript
// ═══════════════════════════════════════════════════════════
// MUSIC QUESTION STARTED (Server → All)
// ═══════════════════════════════════════════════════════════

interface MusicQuestionStartedEvent {
  type: 'MUSIC_QUESTION_STARTED';
  payload: {
    questionId: string;
    questionNumber: number;
    totalQuestions: number;
    questionType: MusicQuestionType;
    questionText: string;
    
    // Visual (blurred for players/display)
    albumArtBlurred: string;    // Blurred album art URL
    
    // Answer settings
    answerMode: 'OPEN_TEXT' | 'MULTIPLE_CHOICE' | 'YEAR_SELECTOR' | 'BUZZER';
    multipleChoiceOptions?: string[];
    yearRange?: { min: number; max: number };
    
    // Timing
    timeLimit: number;          // Seconds to answer
    playbackReady: boolean;     // false = waiting for device
    
    // Hints config (times hidden from players)
    hasHints: boolean;
  };
}

// ═══════════════════════════════════════════════════════════
// HINT REVEALED (Server → Display/Players)
// ═══════════════════════════════════════════════════════════

interface HintRevealedEvent {
  type: 'HINT_REVEALED';
  payload: {
    questionId: string;
    hintType: 'ARTIST' | 'FIRST_LETTER' | 'DECADE' | 'CUSTOM';
    hintValue: string;
  };
}

// ═══════════════════════════════════════════════════════════
// MUSIC REVEAL (Server → All)
// ═══════════════════════════════════════════════════════════

interface MusicRevealEvent {
  type: 'MUSIC_REVEAL';
  payload: {
    questionId: string;
    
    // Track info (now revealed)
    trackName: string;
    artistName: string;
    albumName: string;
    releaseYear: number;
    albumArtClear: string;      // Clear album art
    
    // Correct answer
    correctAnswer: string | number;
    
    // Continue playback?
    continuePlayback: boolean;
    
    // Results
    results: Array<{
      playerId: string;
      playerName: string;
      answer: string | number;
      isCorrect: boolean;
      pointsAwarded: number;
      answerTime: number;       // ms since question started
    }>;
  };
}

// ═══════════════════════════════════════════════════════════
// BUZZER EVENTS (for INTRO_CHALLENGE)
// ═══════════════════════════════════════════════════════════

interface BuzzerPressedEvent {
  type: 'BUZZER_PRESSED';
  payload: {
    sessionCode: string;
    playerId: string;
    timestamp: number;
  };
}

interface BuzzerWinnerEvent {
  type: 'BUZZER_WINNER';
  payload: {
    questionId: string;
    playerId: string;
    playerName: string;
    answerTimeLimit: number;    // Seconds to answer
  };
}

interface BuzzerAnswerEvent {
  type: 'BUZZER_ANSWER';
  payload: {
    sessionCode: string;
    playerId: string;
    answer: string;
  };
}

interface BuzzerResultEvent {
  type: 'BUZZER_RESULT';
  payload: {
    questionId: string;
    playerId: string;
    playerName: string;
    answer: string;
    isCorrect: boolean;
    pointsAwarded: number;
    continueToNextAttempt: boolean; // For progressive mode
  };
}
```

### 9.5 Host Control Events

```typescript
// ═══════════════════════════════════════════════════════════
// PLAY MUSIC (Host → Server)
// ═══════════════════════════════════════════════════════════

interface HostPlayMusicEvent {
  type: 'HOST_PLAY_MUSIC';
  payload: {
    sessionCode: string;
  };
}

// ═══════════════════════════════════════════════════════════
// PAUSE MUSIC (Host → Server)
// ═══════════════════════════════════════════════════════════

interface HostPauseMusicEvent {
  type: 'HOST_PAUSE_MUSIC';
  payload: {
    sessionCode: string;
  };
}

// ═══════════════════════════════════════════════════════════
// RESUME MUSIC (Host → Server)
// ═══════════════════════════════════════════════════════════

interface HostResumeMusicEvent {
  type: 'HOST_RESUME_MUSIC';
  payload: {
    sessionCode: string;
  };
}

// ═══════════════════════════════════════════════════════════
// STOP MUSIC (Host → Server)
// ═══════════════════════════════════════════════════════════

interface HostStopMusicEvent {
  type: 'HOST_STOP_MUSIC';
  payload: {
    sessionCode: string;
  };
}

// ═══════════════════════════════════════════════════════════
// CHANGE VOLUME (Host → Server)
// ═══════════════════════════════════════════════════════════

interface HostChangeVolumeEvent {
  type: 'HOST_CHANGE_VOLUME';
  payload: {
    sessionCode: string;
    volume: number;             // 0-100
  };
}

// ═══════════════════════════════════════════════════════════
// UPDATE AUDIO SETTINGS (Host → Server)
// ═══════════════════════════════════════════════════════════

interface HostUpdateAudioSettingsEvent {
  type: 'HOST_UPDATE_AUDIO_SETTINGS';
  payload: {
    sessionCode: string;
    settings: {
      playbackStrategy?: 'SDK_DEVICE' | 'SPOTIFY_CONNECT' | 'PREVIEW_ONLY';
      volume?: number;
      stopMode?: 'PAUSE' | 'FADE';
      fadeOutMs?: number;
    };
  };
}
```

---

## 10. API Endpoints

### 10.1 Existing Endpoints (Already Implemented)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/spotify/auth` | GET | Start OAuth PKCE flow |
| `/api/spotify/callback` | GET | Handle OAuth callback |
| `/api/spotify/search` | GET | Search tracks |
| `/api/spotify/track/[id]` | GET | Get track details |

### 10.2 New Endpoints Required

#### 10.2.1 Playback Control

```typescript
// POST /api/spotify/playback/play
// Start playback on a specific device
{
  deviceId: string;
  trackUri: string;
  positionMs?: number;
}

// PUT /api/spotify/playback/pause
// Pause current playback
{
  deviceId?: string;
}

// PUT /api/spotify/playback/resume
// Resume paused playback
{
  deviceId?: string;
}

// PUT /api/spotify/playback/seek
// Seek to position
{
  deviceId?: string;
  positionMs: number;
}

// PUT /api/spotify/playback/volume
// Set volume
{
  deviceId?: string;
  volumePercent: number; // 0-100
}

// PUT /api/spotify/playback/transfer
// Transfer playback to device
{
  deviceId: string;
  play?: boolean;
}
```

#### 10.2.2 Device Management

```typescript
// GET /api/spotify/devices
// List available devices
Response: {
  devices: Array<{
    id: string;
    name: string;
    type: string;
    is_active: boolean;
    volume_percent: number;
  }>;
}

// GET /api/spotify/playback/state
// Get current playback state
Response: {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
  device: SpotifyDevice | null;
}
```

#### 10.2.3 Session Audio Settings

```typescript
// GET /api/sessions/[code]/audio
// Get session audio settings
Response: SessionAudioSettings;

// PUT /api/sessions/[code]/audio
// Update session audio settings
{
  playbackStrategy?: string;
  volume?: number;
  stopMode?: string;
  fadeOutMs?: number;
}

// POST /api/sessions/[code]/audio/device
// Register display device
{
  spotifyDeviceId: string;
  deviceName: string;
  capabilities: AudioDeviceCapabilities;
}

// DELETE /api/sessions/[code]/audio/device
// Unregister display device
```

---

## 11. Implementation Phases

### Phase 0: Proof of Concept (1-2 hours) ⚡ CRITICAL FIRST

**Goal:** Validate that Spotify playback works before building anything else.

**Tasks:**
1. Create test page at `/test/spotify-playback`
2. Initialize Web Playback SDK in browser
3. Create simple API endpoint for play/pause
4. Test: transfer → seek → play 10 seconds → fade → pause
5. Verify on different browsers (Chrome, Edge, Firefox)

**Success Criteria:**
- [ ] SDK initializes without errors
- [ ] Can transfer playback to browser
- [ ] Can seek to specific position
- [ ] Can play for exact duration
- [ ] Fade out works smoothly

**If this fails:** Debug and fix before proceeding. No point building UI if playback doesn't work.

---

### Phase 1: Database & Types (1 hour)

**Tasks:**
1. Add Prisma schema extensions for LiveSession
2. Create `packages/shared/src/spotify-types.ts`
3. Add new WS events to `ws-events.ts`
4. Run database migration

**Files to modify:**
- `apps/web/prisma/schema.prisma`
- `packages/shared/src/spotify-types.ts` (new)
- `packages/shared/src/ws-events.ts`
- `packages/shared/src/index.ts`

---

### Phase 2: Device Registration (2-3 hours)

**Tasks:**
1. Create Spotify SDK initialization hook
2. Add device registration on display page load
3. Implement heartbeat (every 5 seconds)
4. Create WS handlers for device events
5. Store device info in session

**Files to create/modify:**
- `apps/web/src/hooks/useSpotifySDK.ts` (new)
- `apps/web/src/app/display/[code]/SpotifyDeviceManager.tsx` (new)
- `apps/ws/src/handlers/spotify-device.ts` (new)

---

### Phase 3: Host Audio Settings (2-3 hours)

**Tasks:**
1. Create Audio Setup panel component
2. Device status indicator
3. Lock/unlock device controls
4. Playback strategy selector
5. Volume and fade settings

**Files to create/modify:**
- `apps/web/src/components/host/AudioSetupPanel.tsx` (new)
- `apps/web/src/components/host/DeviceStatus.tsx` (new)
- `apps/web/src/components/host/VolumeControl.tsx` (new)
- `apps/web/src/app/host/[code]/page.tsx`

---

### Phase 4: Quiz Builder - Track Selection (3-4 hours)

**Tasks:**
1. Enhance SpotifyTrackSelector with preview indicator
2. Create fragment selector (start position, duration)
3. Add waveform visualization (optional, can use simple slider)
4. Preview playback in builder
5. Save to Question.mediaConfig

**Files to create/modify:**
- `apps/web/src/components/SpotifyTrackSelector.tsx`
- `apps/web/src/components/builder/MusicFragmentSelector.tsx` (new)
- `apps/web/src/components/builder/MusicQuestionBuilder.tsx` (new)

---

### Phase 5: Live Playback Controls (3-4 hours)

**Tasks:**
1. Create playback control panel for host
2. Implement play/pause/stop/seek via WebSocket
3. Display receives commands and controls SDK
4. Fade out implementation
5. Progress sync broadcast

**Files to create/modify:**
- `apps/web/src/components/host/PlaybackControls.tsx` (new)
- `apps/web/src/app/display/[code]/SpotifyPlaybackHandler.tsx` (new)
- `apps/ws/src/handlers/spotify-playback.ts` (new)

---

### Phase 6: Question Flow Integration (3-4 hours)

**Tasks:**
1. `MUSIC_QUESTION_STARTED` event with blurred art
2. Auto-play on question start (or wait for host)
3. Timer sync with playback state
4. Hint reveal system
5. `MUSIC_REVEAL` event with clear art

**Files to create/modify:**
- `apps/ws/src/handlers/music-question.ts` (new)
- `apps/web/src/app/display/[code]/MusicQuestionDisplay.tsx` (new)
- `apps/web/src/app/(player)/play/[code]/MusicQuestionPlayer.tsx` (new)

---

### Phase 7: Year & Buzzer Modes (2-3 hours)

**Tasks:**
1. Year selector component
2. Year scoring logic
3. Buzzer system implementation
4. Progressive intro challenge flow

**Files to create/modify:**
- `apps/web/src/components/player/YearSelector.tsx` (new)
- `apps/web/src/components/player/BuzzerButton.tsx` (new)
- `apps/ws/src/handlers/buzzer.ts` (new)

---

### Phase 8: Polish & Error Handling (2 hours)

**Tasks:**
1. Device takeover detection and recovery
2. Network error handling
3. Fallback chains
4. Loading states and skeletons
5. Error messages and recovery options

---

### Total Estimated Time: 18-24 hours

| Phase | Time | Priority |
|-------|------|----------|
| Phase 0: Proof of Concept | 1-2h | 🔴 Critical |
| Phase 1: Database & Types | 1h | 🔴 Critical |
| Phase 2: Device Registration | 2-3h | 🔴 Critical |
| Phase 3: Host Audio Settings | 2-3h | 🟡 High |
| Phase 4: Quiz Builder | 3-4h | 🟡 High |
| Phase 5: Live Playback | 3-4h | 🔴 Critical |
| Phase 6: Question Flow | 3-4h | 🔴 Critical |
| Phase 7: Year & Buzzer | 2-3h | 🟢 Medium |
| Phase 8: Polish | 2h | 🟢 Medium |

---

## 12. Technical Considerations

### 12.1 Spotify SDK Initialization

```typescript
// useSpotifySDK.ts
export function useSpotifySDK(accessToken: string) {
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load Spotify SDK script
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new Spotify.Player({
        name: 'PartyQuiz Display',
        getOAuthToken: (cb) => cb(accessToken),
        volume: 0.8,
      });

      player.addListener('ready', ({ device_id }) => {
        setDeviceId(device_id);
        setIsReady(true);
      });

      player.addListener('not_ready', ({ device_id }) => {
        setIsReady(false);
      });

      player.addListener('initialization_error', ({ message }) => {
        setError(`Init error: ${message}`);
      });

      player.addListener('authentication_error', ({ message }) => {
        setError(`Auth error: ${message}`);
      });

      player.addListener('account_error', ({ message }) => {
        setError(`Account error: ${message}. Premium required.`);
      });

      player.connect();
      setPlayer(player);
    };

    return () => {
      player?.disconnect();
    };
  }, [accessToken]);

  return { player, deviceId, isReady, error };
}
```

### 12.2 Fade Out Implementation

```typescript
// Smooth volume fade
async function fadeOut(
  player: Spotify.Player, 
  durationMs: number,
  steps: number = 10
): Promise<void> {
  const currentVolume = await player.getVolume();
  const stepDuration = durationMs / steps;
  const volumeStep = currentVolume / steps;

  for (let i = 0; i < steps; i++) {
    await player.setVolume(currentVolume - (volumeStep * (i + 1)));
    await new Promise(r => setTimeout(r, stepDuration));
  }

  await player.pause();
  await player.setVolume(currentVolume); // Restore for next track
}
```

### 12.3 Playback State Sync

```typescript
// On display, poll state every 500ms
useEffect(() => {
  if (!isPlaying) return;

  const interval = setInterval(async () => {
    const state = await player.getCurrentState();
    if (state) {
      socket.emit('PLAYBACK_STATE_UPDATE', {
        sessionCode,
        isPlaying: !state.paused,
        positionMs: state.position,
        trackId: state.track_window.current_track.id,
        timestamp: Date.now(),
      });
    }
  }, 500);

  return () => clearInterval(interval);
}, [isPlaying, player, socket, sessionCode]);
```

### 12.4 Device Takeover Detection

```typescript
// Listen for playback state changes
player.addListener('player_state_changed', (state) => {
  if (!state) return;
  
  // If another device took over, state will indicate it's not playing locally
  // Compare with our expected state
  if (expectedPlaying && state.paused) {
    // Could be normal pause or takeover
    // Check if device is still us
    checkActiveDevice();
  }
});

async function checkActiveDevice() {
  const response = await fetch('/api/spotify/playback/state');
  const state = await response.json();
  
  if (state.device?.id !== ourDeviceId) {
    // Another device took over!
    socket.emit('DEVICE_TAKEOVER', {
      sessionCode,
      newDeviceName: state.device?.name,
    });
  }
}
```

### 12.5 Preview Fallback (When SDK Fails)

```typescript
// If Web Playback SDK fails, fall back to preview URL
function playWithFallback(track: SpotifyTrackConfig) {
  if (sdkReady && playbackStrategy === 'SDK_DEVICE') {
    playWithSDK(track);
  } else if (track.previewUrl && playbackStrategy !== 'SDK_DEVICE') {
    playPreview(track.previewUrl, track.startPositionMs, track.playDurationMs);
  } else {
    showError('Unable to play audio. Check device connection.');
  }
}

function playPreview(url: string, startMs: number, durationMs: number) {
  const audio = new Audio(url);
  audio.currentTime = startMs / 1000;
  audio.play();
  
  setTimeout(() => {
    fadeOutAudio(audio, 500);
  }, durationMs - 500);
}
```

---

## 13. File Structure Overview

```
apps/
├── web/
│   ├── prisma/
│   │   └── schema.prisma          # + LiveSession spotify fields
│   └── src/
│       ├── app/
│       │   ├── api/
│       │   │   └── spotify/
│       │   │       ├── auth/
│       │   │       ├── callback/
│       │   │       ├── search/
│       │   │       ├── track/[id]/
│       │   │       ├── playback/      # NEW
│       │   │       │   ├── play/
│       │   │       │   ├── pause/
│       │   │       │   ├── seek/
│       │   │       │   ├── volume/
│       │   │       │   ├── transfer/
│       │   │       │   └── state/
│       │   │       └── devices/       # NEW
│       │   ├── display/
│       │   │   └── [code]/
│       │   │       ├── page.tsx
│       │   │       ├── SpotifyDeviceManager.tsx    # NEW
│       │   │       ├── SpotifyPlaybackHandler.tsx  # NEW
│       │   │       └── MusicQuestionDisplay.tsx    # NEW
│       │   ├── host/
│       │   │   └── [code]/
│       │   │       ├── page.tsx
│       │   │       ├── AudioSetupPanel.tsx    # NEW
│       │   │       ├── PlaybackControls.tsx   # NEW
│       │   │       └── DeviceStatus.tsx       # NEW
│       │   └── (player)/
│       │       └── play/[code]/
│       │           ├── page.tsx
│       │           ├── MusicQuestionPlayer.tsx  # NEW
│       │           ├── YearSelector.tsx         # NEW
│       │           └── BuzzerButton.tsx         # NEW
│       ├── components/
│       │   ├── SpotifyTrackSelector.tsx    # Enhanced
│       │   ├── SpotifyPlayer.tsx           # Enhanced
│       │   └── builder/
│       │       ├── MusicQuestionBuilder.tsx    # NEW
│       │       └── MusicFragmentSelector.tsx   # NEW
│       └── hooks/
│           └── useSpotifySDK.ts    # NEW
├── ws/
│   └── src/
│       ├── index.ts
│       └── handlers/
│           ├── spotify-device.ts     # NEW
│           ├── spotify-playback.ts   # NEW
│           ├── music-question.ts     # NEW
│           └── buzzer.ts             # NEW
└── packages/
    └── shared/
        └── src/
            ├── spotify-types.ts   # NEW
            ├── ws-events.ts       # Extended
            └── index.ts           # Export new types
```

---

## 14. Testing Checklist

### 14.1 Device Registration
- [ ] Display initializes SDK successfully
- [ ] Device appears in Spotify's device list
- [ ] Device registration shows in host panel
- [ ] Heartbeat keeps device active
- [ ] Device lock prevents takeover
- [ ] Device unlock allows takeover

### 14.2 Playback Control
- [ ] Play starts at correct position
- [ ] Playback stops after duration
- [ ] Fade out is smooth
- [ ] Pause works correctly
- [ ] Resume continues from pause point
- [ ] Volume changes work
- [ ] Seek to position works

### 14.3 Question Flow
- [ ] Music question shows blurred album art
- [ ] Playback starts automatically (or on host click)
- [ ] Progress bar syncs with actual playback
- [ ] Timer is independent of playback
- [ ] Reveal shows clear album art
- [ ] Music continues after reveal (if configured)

### 14.4 Error Handling
- [ ] SDK initialization failure shows fallback options
- [ ] Network disconnection is handled gracefully
- [ ] Token expiry triggers refresh
- [ ] Device takeover shows warning
- [ ] Reclaim device works

### 14.5 Browser Compatibility
- [ ] Chrome (latest) ✓
- [ ] Edge (latest) ✓
- [ ] Firefox (latest) - SDK may have issues
- [ ] Safari - SDK may have issues
- [ ] Samsung TV browser - fallback expected

---

## 15. Known Limitations

1. **Spotify Premium Required:** Web Playback SDK requires Premium account
2. **One Stream Per Account:** Cannot play on multiple devices simultaneously
3. **Preview URLs Unreliable:** Many tracks return `null` for preview_url
4. **TV Browser Support:** Smart TV browsers often don't support Web Playback SDK
5. **Lyrics Not Available:** Spotify API doesn't provide lyrics
6. **30-Second Previews:** Preview clips are always 30 seconds, starting point not controllable

---

## 16. Future Enhancements (Out of Scope)

- [ ] Mini-games (MUSIC_QUEUE, MUSIC_BATTLE)
- [ ] Playlist-based quiz generation
- [ ] AI-generated wrong answers
- [ ] Multi-account support for simultaneous playback
- [ ] Offline mode with cached audio
- [ ] Lyrics integration via third-party service

---

*Document created: February 13, 2026*
*Last updated: February 13, 2026*
