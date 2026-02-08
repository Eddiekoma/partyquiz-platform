import { QuestionType } from "./types";

/**
 * Answer validation and scoring utilities
 * Used by both API routes and WebSocket server
 * 
 * SCORING MODES:
 * - EXACT_MATCH: 100% or 0% (MCQ single, True/False)
 * - PARTIAL_MULTI: Points per correct choice, penalty for wrong (MCQ multiple)
 * - PARTIAL_ORDER: Points per item in correct position (Ordering)
 * - FUZZY_TEXT: Graduated based on text similarity (Open text)
 * - NUMERIC_DISTANCE: Graduated based on how close to correct number (Estimation)
 * - NO_SCORE: No points awarded (Polls, votes)
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export enum ScoringMode {
  EXACT_MATCH = "EXACT_MATCH",
  PARTIAL_MULTI = "PARTIAL_MULTI",
  PARTIAL_ORDER = "PARTIAL_ORDER",
  FUZZY_TEXT = "FUZZY_TEXT",
  NUMERIC_DISTANCE = "NUMERIC_DISTANCE",
  NO_SCORE = "NO_SCORE",
}

export interface ValidationResult {
  isCorrect: boolean;
  score: number;
  scorePercentage: number; // 0-100, how much of max points earned
  feedback?: string;
}

export interface ScoringConfig {
  basePoints: number;
  timeBonus: boolean;
  timeBonusPercentage: number; // 0-100, max percentage bonus for fast answers
  streakBonus: boolean;
  streakBonusPoints: number; // Points per consecutive correct answer
}

export interface QuizScoringSettings {
  timeBonus: boolean;
  timeBonusPercentage: number; // 0-100
  streakBonus: boolean;
  streakBonusPoints: number;
}

export interface EstimationConfig {
  correctAnswer: number;
  margin: number; // Percentage margin for full points
}

// ============================================
// SCORING INFO (for UI display)
// ============================================

export interface ScoringInfo {
  mode: ScoringMode;
  title: string;
  description: string;
  tiers: { threshold: string; percentage: number; description: string }[];
}

/**
 * Get scoring information for a question type
 * Used to display how scoring works in the UI
 */
export function getScoringInfo(questionType: string): ScoringInfo {
  const mode = getQuestionScoringMode(questionType);
  
  switch (mode) {
    case ScoringMode.EXACT_MATCH:
      return {
        mode,
        title: "Exact Match",
        description: "Het antwoord moet exact correct zijn.",
        tiers: [
          { threshold: "Correct", percentage: 100, description: "Volledig juist" },
          { threshold: "Incorrect", percentage: 0, description: "Fout antwoord" },
        ],
      };
      
    case ScoringMode.PARTIAL_MULTI:
      return {
        mode,
        title: "Partiële Punten (Meerkeuze)",
        description: "Punten per correct gekozen optie. Foute keuzes geven aftrek.",
        tiers: [
          { threshold: "Alle correct", percentage: 100, description: "Alle juiste opties geselecteerd" },
          { threshold: "Gedeeltelijk", percentage: 50, description: "Sommige juist, sommige fout" },
          { threshold: "Geen correct", percentage: 0, description: "Geen juiste opties" },
        ],
      };
      
    case ScoringMode.PARTIAL_ORDER:
      return {
        mode,
        title: "Partiële Punten (Volgorde)",
        description: "Punten per item op de juiste positie.",
        tiers: [
          { threshold: "Alles goed", percentage: 100, description: "Alle items op juiste plek" },
          { threshold: "3 van 4 goed", percentage: 75, description: "75% op juiste positie" },
          { threshold: "2 van 4 goed", percentage: 50, description: "50% op juiste positie" },
          { threshold: "1 van 4 goed", percentage: 25, description: "25% op juiste positie" },
          { threshold: "Niets goed", percentage: 0, description: "Geen items correct" },
        ],
      };
      
    case ScoringMode.FUZZY_TEXT:
      return {
        mode,
        title: "Fuzzy Text Match",
        description: "Punten op basis van hoe goed het antwoord overeenkomt. Kleine typfouten zijn toegestaan.",
        tiers: [
          { threshold: "100% match", percentage: 100, description: "Exact correct" },
          { threshold: "95-99%", percentage: 90, description: "Bijna perfect, 1 kleine typo" },
          { threshold: "90-94%", percentage: 80, description: "Kleine afwijking" },
          { threshold: "85-89%", percentage: 70, description: "Herkenbaar correct" },
          { threshold: "80-84%", percentage: 50, description: "Nog acceptabel" },
          { threshold: "< 80%", percentage: 0, description: "Te veel fouten" },
        ],
      };
      
    case ScoringMode.NUMERIC_DISTANCE:
      return {
        mode,
        title: "Numerieke Schatting",
        description: "Punten op basis van hoe dicht bij het juiste antwoord. Binnen de marge = volle punten.",
        tiers: [
          { threshold: "Exact", percentage: 100, description: "Precies goed" },
          { threshold: "Binnen 5%", percentage: 90, description: "Heel dichtbij" },
          { threshold: "Binnen 10%", percentage: 80, description: "Dichtbij" },
          { threshold: "Binnen 15%", percentage: 60, description: "Redelijk" },
          { threshold: "Binnen 25%", percentage: 40, description: "In de buurt" },
          { threshold: "Binnen 50%", percentage: 20, description: "Ver weg maar richting goed" },
          { threshold: "> 50%", percentage: 0, description: "Te ver van correct" },
        ],
      };
      
    case ScoringMode.NO_SCORE:
      return {
        mode,
        title: "Geen Punten",
        description: "Dit is een poll of stemming. Er worden geen punten toegekend.",
        tiers: [
          { threshold: "Alle antwoorden", percentage: 0, description: "Meningen, geen goed/fout" },
        ],
      };
      
    default:
      return {
        mode: ScoringMode.EXACT_MATCH,
        title: "Standaard",
        description: "Standaard scoring",
        tiers: [],
      };
  }
}

/**
 * Get the scoring mode for a question type
 * Maps both shared QuestionType enum values and database type strings
 */
export function getQuestionScoringMode(questionType: string): ScoringMode {
  // Normalize the type string
  const type = questionType.toUpperCase();
  
  // Exact match types (100% or 0%)
  const exactMatchTypes = [
    "MC_SINGLE", "MCQ", "TRUE_FALSE", 
    "MUSIC_OLDER_NEWER_THAN", "YOUTUBE_WHO_SAID_IT",
    "PHOTO_QUESTION", "AUDIO_QUESTION", "VIDEO_QUESTION", // When used as MCQ
  ];
  
  // Partial multi types (multiple correct answers)
  const partialMultiTypes = ["MC_MULTIPLE"];
  
  // Partial order types (ordering)
  const partialOrderTypes = [
    "ORDER", "ORDERING", 
    "PHOTO_TIMELINE", "MUSIC_HITSTER_TIMELINE",
  ];
  
  // Fuzzy text types (text similarity)
  const fuzzyTextTypes = [
    "OPEN", "OPEN_TEXT", 
    "PHOTO_GUESS", "PHOTO_ZOOM_REVEAL", "PHOTO_OPEN",
    "AUDIO_OPEN", "VIDEO_OPEN",
    "MUSIC_GUESS_TITLE", "MUSIC_GUESS_ARTIST",
    "YOUTUBE_NEXT_LINE", "YOUTUBE_SCENE_QUESTION",
  ];
  
  // Numeric distance types (estimation)
  const numericDistanceTypes = [
    "ESTIMATION", "MUSIC_GUESS_YEAR",
  ];
  
  // No score types (polls, votes)
  const noScoreTypes = [
    "POLL", "EMOJI_VOTE", "CHAOS_EVENT",
  ];
  
  if (exactMatchTypes.includes(type)) return ScoringMode.EXACT_MATCH;
  if (partialMultiTypes.includes(type)) return ScoringMode.PARTIAL_MULTI;
  if (partialOrderTypes.includes(type)) return ScoringMode.PARTIAL_ORDER;
  if (fuzzyTextTypes.includes(type)) return ScoringMode.FUZZY_TEXT;
  if (numericDistanceTypes.includes(type)) return ScoringMode.NUMERIC_DISTANCE;
  if (noScoreTypes.includes(type)) return ScoringMode.NO_SCORE;
  
  // Default to exact match
  return ScoringMode.EXACT_MATCH;
}

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Normalize strings for comparison (lowercase, trim, remove extra spaces)
 */
export function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Calculate similarity between two strings (0-1)
 */
export function calculateSimilarity(answer: string, correct: string): number {
  const normalizedAnswer = normalizeString(answer);
  const normalizedCorrect = normalizeString(correct);

  // Exact match
  if (normalizedAnswer === normalizedCorrect) return 1;

  // Empty strings
  if (!normalizedAnswer || !normalizedCorrect) return 0;

  // Levenshtein distance for fuzzy matching
  const distance = levenshteinDistance(normalizedAnswer, normalizedCorrect);
  const maxLength = Math.max(normalizedAnswer.length, normalizedCorrect.length);
  const similarity = 1 - distance / maxLength;

  return Math.max(0, Math.min(1, similarity));
}

/**
 * Check if two strings are approximately equal (fuzzy match)
 * Returns true if similarity >= threshold
 */
export function fuzzyMatch(answer: string, correct: string, threshold = 0.85): boolean {
  return calculateSimilarity(answer, correct) >= threshold;
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

// ============================================
// GRADUATED SCORING FUNCTIONS
// ============================================

/**
 * Calculate score percentage for fuzzy text match
 * Returns 0-100 based on similarity
 */
export function calculateFuzzyScorePercentage(similarity: number): number {
  if (similarity >= 1.0) return 100;
  if (similarity >= 0.95) return 90;
  if (similarity >= 0.90) return 80;
  if (similarity >= 0.85) return 70;
  if (similarity >= 0.80) return 50;
  return 0;
}

/**
 * Calculate score percentage for numeric distance (estimation)
 * Returns 0-100 based on how close the answer is
 */
export function calculateNumericScorePercentage(
  playerAnswer: number,
  correctAnswer: number,
  margin: number = 10 // Default 10% margin
): number {
  if (correctAnswer === 0) {
    // Avoid division by zero
    return playerAnswer === 0 ? 100 : 0;
  }
  
  const difference = Math.abs(playerAnswer - correctAnswer);
  const percentageDiff = (difference / Math.abs(correctAnswer)) * 100;
  
  // Exact match
  if (percentageDiff === 0) return 100;
  
  // Within margin = full points
  if (percentageDiff <= margin) return 100;
  
  // Graduated scoring based on distance
  if (percentageDiff <= 5) return 90;
  if (percentageDiff <= 10) return 80;
  if (percentageDiff <= 15) return 60;
  if (percentageDiff <= 25) return 40;
  if (percentageDiff <= 50) return 20;
  
  return 0;
}

/**
 * Calculate score percentage for year guessing (special case)
 * More lenient: ±1 year = 100%, ±2 = 80%, etc.
 */
export function calculateYearScorePercentage(
  playerYear: number,
  correctYear: number
): number {
  const diff = Math.abs(playerYear - correctYear);
  
  if (diff === 0) return 100;
  if (diff === 1) return 90;
  if (diff === 2) return 70;
  if (diff === 3) return 50;
  if (diff <= 5) return 30;
  if (diff <= 10) return 10;
  
  return 0;
}

/**
 * Calculate score percentage for ordering questions
 * Points per item in correct position
 */
export function calculateOrderScorePercentage(
  playerAnswer: any[],
  correctAnswer: any[]
): number {
  if (!Array.isArray(playerAnswer) || !Array.isArray(correctAnswer)) return 0;
  if (playerAnswer.length === 0 || correctAnswer.length === 0) return 0;
  
  let correctCount = 0;
  const totalItems = correctAnswer.length;
  
  for (let i = 0; i < Math.min(playerAnswer.length, correctAnswer.length); i++) {
    if (playerAnswer[i] === correctAnswer[i]) {
      correctCount++;
    }
  }
  
  return Math.round((correctCount / totalItems) * 100);
}

/**
 * Calculate score percentage for multiple choice (multiple answers)
 * Correct choices add points, wrong choices subtract
 */
export function calculateMultiChoiceScorePercentage(
  playerAnswers: any[],
  correctAnswers: any[],
  _allOptions: any[]
): number {
  if (!Array.isArray(playerAnswers) || !Array.isArray(correctAnswers)) return 0;
  if (correctAnswers.length === 0) return 0;
  
  // Ensure playerAnswers is an array
  const selected = Array.isArray(playerAnswers) ? playerAnswers : [playerAnswers];
  
  let score = 0;
  const pointsPerCorrect = 100 / correctAnswers.length;
  const penaltyPerWrong = pointsPerCorrect / 2; // Half penalty for wrong selections
  
  for (const answer of selected) {
    if (correctAnswers.includes(answer)) {
      score += pointsPerCorrect;
    } else {
      score -= penaltyPerWrong;
    }
  }
  
  // Check for missed correct answers (no penalty, just no points)
  // Already handled by only giving points for selected correct answers
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ============================================
// MAIN VALIDATION FUNCTIONS
// ============================================

/**
 * Validate and calculate score percentage for any question type
 * Returns score as percentage (0-100)
 */
export function validateAndScorePercentage(
  questionType: string,
  playerAnswer: any,
  correctAnswer: any,
  options?: {
    allOptions?: any[];
    estimationMargin?: number;
    acceptableAnswers?: string[]; // For open text with multiple correct answers
  }
): { isCorrect: boolean; scorePercentage: number } {
  const mode = getQuestionScoringMode(questionType);
  
  switch (mode) {
    case ScoringMode.EXACT_MATCH: {
      const isCorrect = playerAnswer === correctAnswer;
      return { isCorrect, scorePercentage: isCorrect ? 100 : 0 };
    }
    
    case ScoringMode.PARTIAL_MULTI: {
      const scorePercentage = calculateMultiChoiceScorePercentage(
        playerAnswer,
        Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer],
        options?.allOptions || []
      );
      return { isCorrect: scorePercentage >= 50, scorePercentage };
    }
    
    case ScoringMode.PARTIAL_ORDER: {
      const scorePercentage = calculateOrderScorePercentage(playerAnswer, correctAnswer);
      return { isCorrect: scorePercentage === 100, scorePercentage };
    }
    
    case ScoringMode.FUZZY_TEXT: {
      // Check against main correct answer
      let bestSimilarity = calculateSimilarity(String(playerAnswer), String(correctAnswer));
      
      // Also check against acceptable answers if provided
      if (options?.acceptableAnswers) {
        for (const acceptable of options.acceptableAnswers) {
          const similarity = calculateSimilarity(String(playerAnswer), acceptable);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
          }
        }
      }
      
      const scorePercentage = calculateFuzzyScorePercentage(bestSimilarity);
      return { isCorrect: scorePercentage >= 70, scorePercentage };
    }
    
    case ScoringMode.NUMERIC_DISTANCE: {
      const playerNum = parseFloat(playerAnswer);
      const correctNum = parseFloat(correctAnswer);
      
      if (isNaN(playerNum) || isNaN(correctNum)) {
        return { isCorrect: false, scorePercentage: 0 };
      }
      
      // Special handling for year questions
      if (questionType.toUpperCase().includes("YEAR")) {
        const scorePercentage = calculateYearScorePercentage(playerNum, correctNum);
        return { isCorrect: scorePercentage >= 70, scorePercentage };
      }
      
      const margin = options?.estimationMargin || 10;
      const scorePercentage = calculateNumericScorePercentage(playerNum, correctNum, margin);
      return { isCorrect: scorePercentage >= 60, scorePercentage };
    }
    
    case ScoringMode.NO_SCORE: {
      // Polls, votes - all answers are "correct" but worth 0 points
      return { isCorrect: true, scorePercentage: 0 };
    }
    
    default:
      return { isCorrect: false, scorePercentage: 0 };
  }
}

/**
 * Legacy validation function for backwards compatibility
 */
export function validateAnswer(
  questionType: QuestionType | string,
  playerAnswer: any,
  correctAnswer: any
): boolean {
  const result = validateAndScorePercentage(String(questionType), playerAnswer, correctAnswer);
  return result.isCorrect;
}

// ============================================
// SCORE CALCULATION WITH BONUSES
// ============================================

/**
 * Calculate final score with time bonus and streak
 */
export function calculateScore(
  scorePercentage: number,
  config: ScoringConfig,
  timeSpentMs?: number,
  timeLimitMs?: number,
  currentStreak?: number
): number {
  // Base score from percentage
  let score = Math.round((scorePercentage / 100) * config.basePoints);
  
  // No bonuses if no points earned
  if (score === 0) return 0;

  // Time bonus (if enabled and time data available)
  if (config.timeBonus && timeSpentMs !== undefined && timeLimitMs !== undefined && timeLimitMs > 0) {
    const timeRemainingMs = timeLimitMs - timeSpentMs;
    if (timeRemainingMs > 0) {
      const timePercentage = timeRemainingMs / timeLimitMs;
      const maxTimeBonus = config.basePoints * (config.timeBonusPercentage / 100);
      const timeBonus = Math.round(maxTimeBonus * timePercentage);
      score += timeBonus;
    }
  }

  // Streak bonus (if enabled)
  if (config.streakBonus && currentStreak !== undefined && currentStreak > 0) {
    const streakBonus = config.streakBonusPoints * currentStreak;
    score += streakBonus;
  }

  return Math.max(0, Math.round(score));
}

/**
 * Get default scoring config for a question type
 */
export function getDefaultScoringConfig(_questionType: string): ScoringConfig {
  return {
    basePoints: 10, // Default from user settings
    timeBonus: true,
    timeBonusPercentage: 50, // Up to 50% bonus
    streakBonus: true,
    streakBonusPoints: 1, // 1 point per streak
  };
}

/**
 * Get default quiz scoring settings
 */
export function getDefaultQuizScoringSettings(): QuizScoringSettings {
  return {
    timeBonus: true,
    timeBonusPercentage: 50,
    streakBonus: true,
    streakBonusPoints: 1,
  };
}

/**
 * Validate and score an answer (main convenience function)
 */
export function validateAndScore(
  questionType: QuestionType | string,
  playerAnswer: any,
  correctAnswer: any,
  configOrBasePoints?: ScoringConfig | number,
  timeSpentMs?: number,
  timeLimitMs?: number,
  currentStreak?: number,
  options?: {
    allOptions?: any[];
    estimationMargin?: number;
    acceptableAnswers?: string[];
  }
): ValidationResult {
  // Get score percentage
  const { isCorrect, scorePercentage } = validateAndScorePercentage(
    String(questionType),
    playerAnswer,
    correctAnswer,
    options
  );

  // Get scoring config
  let config: ScoringConfig;
  if (typeof configOrBasePoints === "number") {
    config = {
      ...getDefaultScoringConfig(String(questionType)),
      basePoints: configOrBasePoints,
    };
  } else if (configOrBasePoints) {
    config = configOrBasePoints;
  } else {
    config = getDefaultScoringConfig(String(questionType));
  }

  // Calculate final score with bonuses
  const score = calculateScore(scorePercentage, config, timeSpentMs, timeLimitMs, currentStreak);

  return {
    isCorrect,
    score,
    scorePercentage,
  };
}
