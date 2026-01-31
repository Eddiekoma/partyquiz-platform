import { QuestionType } from "./types";

/**
 * Answer validation and scoring utilities
 * Used by both API routes and WebSocket server
 */

export interface ValidationResult {
  isCorrect: boolean;
  score: number;
  feedback?: string;
}

export interface ScoringConfig {
  basePoints: number;
  timeBonus: boolean;
  timeBonusMultiplier?: number; // 0-1, percentage of time left
  streakBonus?: number; // Bonus points per consecutive correct answer
}

/**
 * Normalize strings for comparison (lowercase, trim, remove extra spaces)
 */
export function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Check if two strings are approximately equal (fuzzy match)
 * Allows for minor typos and variations
 */
export function fuzzyMatch(answer: string, correct: string, threshold = 0.85): boolean {
  const normalizedAnswer = normalizeString(answer);
  const normalizedCorrect = normalizeString(correct);

  // Exact match
  if (normalizedAnswer === normalizedCorrect) return true;

  // Levenshtein distance for fuzzy matching
  const distance = levenshteinDistance(normalizedAnswer, normalizedCorrect);
  const maxLength = Math.max(normalizedAnswer.length, normalizedCorrect.length);
  const similarity = 1 - distance / maxLength;

  return similarity >= threshold;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Validate answer based on question type
 */
export function validateAnswer(
  questionType: QuestionType,
  playerAnswer: any,
  correctAnswer: any
): boolean {
  switch (questionType) {
    // Multiple Choice
    case QuestionType.MCQ:
      if (Array.isArray(correctAnswer)) {
        // Multiple correct answers (checkboxes)
        const playerAnswers = Array.isArray(playerAnswer) ? playerAnswer : [playerAnswer];
        return (
          playerAnswers.length === correctAnswer.length &&
          playerAnswers.every((a) => correctAnswer.includes(a))
        );
      } else {
        // Single correct answer (radio)
        return playerAnswer === correctAnswer;
      }

    // True/False
    case QuestionType.TRUE_FALSE:
      return playerAnswer === correctAnswer;

    // Open text (fuzzy matching)
    case QuestionType.OPEN:
      if (typeof correctAnswer === "string") {
        return fuzzyMatch(playerAnswer, correctAnswer);
      } else if (Array.isArray(correctAnswer)) {
        // Multiple acceptable answers
        return correctAnswer.some((ans) => fuzzyMatch(playerAnswer, ans));
      }
      return false;

    // Ordering (check array sequence)
    case QuestionType.ORDERING:
      if (!Array.isArray(playerAnswer) || !Array.isArray(correctAnswer)) return false;
      if (playerAnswer.length !== correctAnswer.length) return false;
      return playerAnswer.every((item, index) => item === correctAnswer[index]);

    // Photo-based questions
    case QuestionType.PHOTO_GUESS:
      return fuzzyMatch(playerAnswer, correctAnswer);

    case QuestionType.PHOTO_ZOOM_REVEAL:
      return fuzzyMatch(playerAnswer, correctAnswer);

    case QuestionType.PHOTO_TIMELINE:
      // Timeline ordering validation
      if (!Array.isArray(playerAnswer) || !Array.isArray(correctAnswer)) return false;
      return playerAnswer.every((item, index) => item === correctAnswer[index]);

    // Music-based questions (Spotify)
    case QuestionType.MUSIC_GUESS_TITLE:
      return fuzzyMatch(playerAnswer, correctAnswer);

    case QuestionType.MUSIC_GUESS_ARTIST:
      return fuzzyMatch(playerAnswer, correctAnswer);

    case QuestionType.MUSIC_GUESS_YEAR:
      // Allow ±1 year tolerance
      const playerYear = parseInt(playerAnswer);
      const correctYear = parseInt(correctAnswer);
      return Math.abs(playerYear - correctYear) <= 1;

    case QuestionType.MUSIC_HITSTER_TIMELINE:
      // Timeline ordering validation
      if (!Array.isArray(playerAnswer) || !Array.isArray(correctAnswer)) return false;
      return playerAnswer.every((item, index) => item === correctAnswer[index]);

    case QuestionType.MUSIC_OLDER_NEWER_THAN:
      return playerAnswer === correctAnswer; // "older" or "newer"

    // Video-based questions (YouTube)
    case QuestionType.YOUTUBE_SCENE_QUESTION:
      if (typeof correctAnswer === "string") {
        return playerAnswer === correctAnswer; // MCQ style
      }
      return fuzzyMatch(playerAnswer, correctAnswer); // Open text

    case QuestionType.YOUTUBE_NEXT_LINE:
      return fuzzyMatch(playerAnswer, correctAnswer, 0.8); // More lenient for quotes

    case QuestionType.YOUTUBE_WHO_SAID_IT:
      return playerAnswer === correctAnswer;

    // Social/Party (no wrong answers)
    case QuestionType.POLL:
      return true; // All answers are valid

    case QuestionType.EMOJI_VOTE:
      return true; // All answers are valid

    case QuestionType.CHAOS_EVENT:
      return true; // All answers are valid

    default:
      console.warn(`Unknown question type: ${questionType}`);
      return false;
  }
}

/**
 * Calculate score with time bonus and streak
 */
export function calculateScore(
  isCorrect: boolean,
  config: ScoringConfig,
  timeSpentMs?: number,
  timeLimitMs?: number,
  currentStreak?: number
): number {
  if (!isCorrect) return 0;

  let score = config.basePoints;

  // Time bonus (if enabled and time data available)
  if (config.timeBonus && timeSpentMs !== undefined && timeLimitMs !== undefined && timeLimitMs > 0) {
    const timeRemainingMs = timeLimitMs - timeSpentMs;
    if (timeRemainingMs > 0) {
      const timePercentage = timeRemainingMs / timeLimitMs;
      const bonusMultiplier = config.timeBonusMultiplier || 0.5;
      const timeBonus = Math.round(config.basePoints * bonusMultiplier * timePercentage);
      score += timeBonus;
    }
  }

  // Streak bonus
  if (config.streakBonus && currentStreak !== undefined && currentStreak > 0) {
    const streakBonus = config.streakBonus * currentStreak;
    score += streakBonus;
  }

  return Math.max(0, Math.round(score));
}

/**
 * Get default scoring config for a question type
 */
export function getDefaultScoringConfig(questionType: QuestionType): ScoringConfig {
  // Base points vary by difficulty/type
  const basePoints = (() => {
    switch (questionType) {
      case QuestionType.TRUE_FALSE:
        return 100;
      case QuestionType.MCQ:
        return 200;
      case QuestionType.OPEN:
        return 300;
      case QuestionType.ORDERING:
        return 400;
      case QuestionType.PHOTO_TIMELINE:
      case QuestionType.MUSIC_HITSTER_TIMELINE:
        return 500;
      case QuestionType.MUSIC_GUESS_YEAR:
        return 250;
      case QuestionType.YOUTUBE_NEXT_LINE:
        return 350;
      default:
        return 200;
    }
  })();

  // Social/Party questions don't have time pressure
  const socialTypes = [QuestionType.POLL, QuestionType.EMOJI_VOTE, QuestionType.CHAOS_EVENT];
  const timeBonus = !socialTypes.includes(questionType);

  return {
    basePoints,
    timeBonus,
    timeBonusMultiplier: 0.5, // Up to 50% bonus for fast answers
    streakBonus: 50, // 50 points per consecutive correct answer
  };
}

/**
 * Validate and score an answer (convenience function)
 */
export function validateAndScore(
  questionType: QuestionType,
  playerAnswer: any,
  correctAnswer: any,
  configOrBasePoints?: ScoringConfig | number,
  timeSpentMs?: number,
  timeLimitMs?: number,
  currentStreak?: number
): ValidationResult {
  const isCorrect = validateAnswer(questionType, playerAnswer, correctAnswer);

  // Get scoring config
  let config: ScoringConfig;
  if (typeof configOrBasePoints === "number") {
    config = {
      ...getDefaultScoringConfig(questionType),
      basePoints: configOrBasePoints,
    };
  } else if (configOrBasePoints) {
    config = configOrBasePoints;
  } else {
    config = getDefaultScoringConfig(questionType);
  }

  const score = calculateScore(isCorrect, config, timeSpentMs, timeLimitMs, currentStreak);

  return {
    isCorrect,
    score,
  };
}
