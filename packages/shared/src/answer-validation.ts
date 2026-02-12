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

/**
 * Answer format enum - describes what format the player answer should be in
 * Maps to the 19 official question types from the editor
 */
export enum AnswerFormat {
  OPTION_ID = "OPTION_ID",           // MC_SINGLE, PHOTO_QUESTION, AUDIO_QUESTION, VIDEO_QUESTION, YOUTUBE_WHO_SAID_IT
  OPTION_IDS = "OPTION_IDS",         // MC_MULTIPLE - player sends array of option IDs
  BOOLEAN = "BOOLEAN",               // TRUE_FALSE - player sends true/false
  TEXT = "TEXT",                     // OPEN_TEXT, *_OPEN, MUSIC_GUESS_*, YOUTUBE_NEXT_LINE, YOUTUBE_SCENE_QUESTION
  NUMBER = "NUMBER",                 // ESTIMATION, MUSIC_GUESS_YEAR
  ORDER_ARRAY = "ORDER_ARRAY",       // ORDER - player sends ordered array of IDs
  NO_ANSWER = "NO_ANSWER",           // POLL - no correct answer, just opinion
}

/**
 * Option interface for question options
 */
export interface QuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
  order?: number;
}

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
  streakBonus: boolean;
  streakBonusPoints: number; // Points per consecutive correct answer
  // Speed Podium: top 3 fastest 100% correct players get bonus
  speedPodiumEnabled?: boolean;
  speedPodiumPercentages?: { first: number; second: number; third: number };
}

export interface QuizScoringSettings {
  streakBonus: boolean;
  streakBonusPoints: number;
  // Speed Podium: top 3 fastest 100% correct players get bonus
  speedPodiumEnabled?: boolean;
  speedPodiumPercentages?: { first: number; second: number; third: number };
}

/**
 * Speed Podium result for a player
 */
export interface SpeedPodiumResult {
  playerId: string;
  position: 1 | 2 | 3;
  baseScore: number;
  bonusPercentage: number;
  bonusPoints: number;
  finalScore: number;
  timeSpentMs: number;
}

/**
 * Default speed podium percentages
 */
export const DEFAULT_SPEED_PODIUM_PERCENTAGES = {
  first: 30,
  second: 20,
  third: 10,
};

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
        description: "The answer must be exactly correct.",
        tiers: [
          { threshold: "Correct", percentage: 100, description: "Fully correct" },
          { threshold: "Incorrect", percentage: 0, description: "Wrong answer" },
        ],
      };
      
    case ScoringMode.PARTIAL_MULTI:
      return {
        mode,
        title: "Partial Points (Multiple Choice)",
        description: "Points per correctly chosen option. Wrong choices deduct points.",
        tiers: [
          { threshold: "All correct", percentage: 100, description: "All correct options selected" },
          { threshold: "Partial", percentage: 50, description: "Some correct, some wrong" },
          { threshold: "None correct", percentage: 0, description: "No correct options" },
        ],
      };
      
    case ScoringMode.PARTIAL_ORDER:
      return {
        mode,
        title: "Partial Points (Ordering)",
        description: "Points per item in the correct position. You earn points for each item placed correctly.",
        tiers: [
          { threshold: "All correct", percentage: 100, description: "Every item in the right position" },
          { threshold: "Most correct", percentage: 75, description: "Most items placed correctly" },
          { threshold: "Half correct", percentage: 50, description: "About half in the right position" },
          { threshold: "Few correct", percentage: 25, description: "Only a few items correct" },
          { threshold: "None correct", percentage: 0, description: "No items in the right position" },
        ],
      };
      
    case ScoringMode.FUZZY_TEXT:
      return {
        mode,
        title: "Fuzzy Text Match",
        description: "Points based on how well the answer matches. Small typos are allowed.",
        tiers: [
          { threshold: "100% match", percentage: 100, description: "Exactly correct" },
          { threshold: "95-99%", percentage: 90, description: "Almost perfect, 1 small typo" },
          { threshold: "90-94%", percentage: 80, description: "Minor deviation" },
          { threshold: "85-89%", percentage: 70, description: "Recognizably correct" },
          { threshold: "80-84%", percentage: 50, description: "Still acceptable" },
          { threshold: "< 80%", percentage: 0, description: "Too many errors" },
        ],
      };
      
    case ScoringMode.NUMERIC_DISTANCE:
      return {
        mode,
        title: "Numeric Estimation",
        description: "Points based on how close to the correct answer. Within margin = full points.",
        tiers: [
          { threshold: "Exact", percentage: 100, description: "Exactly right" },
          { threshold: "Within 5%", percentage: 90, description: "Very close" },
          { threshold: "Within 10%", percentage: 80, description: "Close" },
          { threshold: "Within 15%", percentage: 60, description: "Reasonable" },
          { threshold: "Within 25%", percentage: 40, description: "In the ballpark" },
          { threshold: "Within 50%", percentage: 20, description: "Far but right direction" },
          { threshold: "> 50%", percentage: 0, description: "Too far from correct" },
        ],
      };
      
    case ScoringMode.NO_SCORE:
      return {
        mode,
        title: "No Points",
        description: "This is a poll or vote. No points are awarded.",
        tiers: [
          { threshold: "All answers", percentage: 0, description: "Opinions, no right/wrong" },
        ],
      };
      
    default:
      return {
        mode: ScoringMode.EXACT_MATCH,
        title: "Default",
        description: "Default scoring",
        tiers: [],
      };
  }
}

/**
 * Get the scoring mode for a question type
 * Uses the 19 official question types from the editor
 */
export function getQuestionScoringMode(questionType: string): ScoringMode {
  // Normalize the type string
  const type = questionType.toUpperCase();
  
  // Exact match types (100% or 0%) - single correct answer
  const exactMatchTypes = [
    "MC_SINGLE", 
    "TRUE_FALSE", 
    "PHOTO_QUESTION", 
    "AUDIO_QUESTION", 
    "VIDEO_QUESTION",
    "YOUTUBE_WHO_SAID_IT",
  ];
  
  // Partial multi types (multiple correct answers)
  const partialMultiTypes = ["MC_MULTIPLE"];
  
  // Partial order types (ordering) - points per correct position
  const partialOrderTypes = ["ORDER"];
  
  // Fuzzy text types (text similarity matching)
  const fuzzyTextTypes = [
    "OPEN_TEXT", 
    "PHOTO_OPEN",
    "AUDIO_OPEN", 
    "VIDEO_OPEN",
    "MUSIC_GUESS_TITLE", 
    "MUSIC_GUESS_ARTIST",
    "YOUTUBE_NEXT_LINE", 
    "YOUTUBE_SCENE_QUESTION",
  ];
  
  // Numeric distance types (closer = more points)
  const numericDistanceTypes = [
    "ESTIMATION", 
    "MUSIC_GUESS_YEAR",
  ];
  
  // No score types (just opinions, no right/wrong)
  const noScoreTypes = ["POLL"];
  
  if (exactMatchTypes.includes(type)) return ScoringMode.EXACT_MATCH;
  if (partialMultiTypes.includes(type)) return ScoringMode.PARTIAL_MULTI;
  if (partialOrderTypes.includes(type)) return ScoringMode.PARTIAL_ORDER;
  if (fuzzyTextTypes.includes(type)) return ScoringMode.FUZZY_TEXT;
  if (numericDistanceTypes.includes(type)) return ScoringMode.NUMERIC_DISTANCE;
  if (noScoreTypes.includes(type)) return ScoringMode.NO_SCORE;
  
  // Default to exact match for unknown types
  return ScoringMode.EXACT_MATCH;
}

// ============================================
// ANSWER FORMAT DETECTION
// ============================================

/**
 * Get the expected answer format for a question type
 * Uses the 19 official question types from the editor
 */
export function getAnswerFormat(questionType: string): AnswerFormat {
  const type = questionType.toUpperCase();
  
  // Boolean types (true/false)
  if (type === "TRUE_FALSE") {
    return AnswerFormat.BOOLEAN;
  }
  
  // Multiple option IDs
  if (type === "MC_MULTIPLE") {
    return AnswerFormat.OPTION_IDS;
  }
  
  // Ordering (array of IDs in order)
  if (type === "ORDER") {
    return AnswerFormat.ORDER_ARRAY;
  }
  
  // Numeric types
  if (["ESTIMATION", "MUSIC_GUESS_YEAR"].includes(type)) {
    return AnswerFormat.NUMBER;
  }
  
  // Text types (fuzzy matching)
  if ([
    "OPEN_TEXT",
    "PHOTO_OPEN",
    "AUDIO_OPEN", 
    "VIDEO_OPEN",
    "MUSIC_GUESS_TITLE", 
    "MUSIC_GUESS_ARTIST",
    "YOUTUBE_NEXT_LINE", 
    "YOUTUBE_SCENE_QUESTION",
  ].includes(type)) {
    return AnswerFormat.TEXT;
  }
  
  // No answer types (polls - just opinions)
  if (type === "POLL") {
    return AnswerFormat.NO_ANSWER;
  }
  
  // Default: option ID (MC_SINGLE, PHOTO_QUESTION, AUDIO_QUESTION, VIDEO_QUESTION, YOUTUBE_WHO_SAID_IT)
  return AnswerFormat.OPTION_ID;
}

/**
 * Extract the correct answer from question options in the right format
 * This is the KEY function that fixes the TRUE_FALSE and OLDER_NEWER issues
 */
export function extractCorrectAnswer(
  questionType: string,
  options: QuestionOption[],
  settingsJson?: Record<string, any>
): any {
  const format = getAnswerFormat(questionType);
  
  // Find correct options
  const correctOptions = options.filter((opt) => opt.isCorrect);
  
  switch (format) {
    case AnswerFormat.BOOLEAN: {
      // TRUE_FALSE: Return boolean based on which option is correct
      if (correctOptions.length > 0) {
        const correctText = correctOptions[0].text.toLowerCase().trim();
        // Check if correct answer is "true", "yes", "waar", "ja"
        return ["true", "yes", "waar", "ja", "correct", "juist"].includes(correctText);
      }
      // Fallback to settingsJson
      return settingsJson?.correctAnswer === true || settingsJson?.correctAnswer === "true";
    }
    
    case AnswerFormat.OPTION_IDS: {
      // MC_MULTIPLE: Return array of correct option IDs
      return correctOptions.map((opt) => opt.id);
    }
    
    case AnswerFormat.ORDER_ARRAY: {
      // ORDERING: Return options sorted by their correct order
      const sortedOptions = [...options].sort((a, b) => (a.order || 0) - (b.order || 0));
      return sortedOptions.map((opt) => opt.id);
    }
    
    case AnswerFormat.NUMBER: {
      // ESTIMATION/MUSIC_GUESS_YEAR: Return numeric value
      if (settingsJson?.correctAnswer !== undefined) {
        return parseFloat(settingsJson.correctAnswer);
      }
      if (correctOptions.length > 0) {
        return parseFloat(correctOptions[0].text);
      }
      return 0;
    }
    
    case AnswerFormat.TEXT: {
      // OPEN text: Return correct text answer
      if (settingsJson?.correctAnswer) {
        return String(settingsJson.correctAnswer);
      }
      if (correctOptions.length > 0) {
        return correctOptions[0].text;
      }
      if (options.length > 0) {
        return options[0].text;
      }
      return "";
    }
    
    case AnswerFormat.NO_ANSWER: {
      // POLL: No correct answer
      return null;
    }
    
    case AnswerFormat.OPTION_ID:
    default: {
      // MCQ/MC_SINGLE: Return option ID
      if (correctOptions.length > 0) {
        return correctOptions[0].id;
      }
      return options[0]?.id || "";
    }
  }
}

/**
 * Normalize player answer to match the expected format
 * Converts player input to the format needed for comparison
 */
export function normalizePlayerAnswer(
  questionType: string,
  playerAnswer: any
): any {
  const format = getAnswerFormat(questionType);
  
  switch (format) {
    case AnswerFormat.BOOLEAN: {
      // Convert to boolean
      if (typeof playerAnswer === "boolean") {
        return playerAnswer;
      }
      if (typeof playerAnswer === "string") {
        const lower = playerAnswer.toLowerCase().trim();
        return ["true", "yes", "waar", "ja", "correct", "juist", "1"].includes(lower);
      }
      if (typeof playerAnswer === "number") {
        return playerAnswer === 1;
      }
      return Boolean(playerAnswer);
    }
    
    case AnswerFormat.OPTION_IDS: {
      // Ensure array of strings
      if (Array.isArray(playerAnswer)) {
        return playerAnswer.map(String);
      }
      return [String(playerAnswer)];
    }
    
    case AnswerFormat.ORDER_ARRAY: {
      // Ensure array
      if (Array.isArray(playerAnswer)) {
        return playerAnswer;
      }
      return [];
    }
    
    case AnswerFormat.NUMBER: {
      // Convert to number
      if (typeof playerAnswer === "number") {
        return playerAnswer;
      }
      return parseFloat(String(playerAnswer)) || 0;
    }
    
    case AnswerFormat.TEXT: {
      // Convert to string
      return String(playerAnswer || "");
    }
    
    case AnswerFormat.NO_ANSWER: {
      // Poll - just return as-is
      return playerAnswer;
    }
    
    case AnswerFormat.OPTION_ID:
    default: {
      // Return as string
      return String(playerAnswer);
    }
  }
}

/**
 * Complete answer validation with automatic format handling
 * This is the main function to use in the WS server
 */
export function validateAnswerComplete(
  questionType: string,
  playerAnswer: any,
  options: QuestionOption[],
  settingsJson?: Record<string, any>,
  scoringOptions?: {
    basePoints?: number;
    timeSpentMs?: number;
    timeLimitMs?: number;
    currentStreak?: number;
    estimationMargin?: number;
    acceptableAnswers?: string[];
    // Quiz-level scoring settings
    streakBonusEnabled?: boolean;
    streakBonusPoints?: number;
    // Speed Podium: bonus for top 3 fastest 100% correct (applied at lock)
    speedPodiumEnabled?: boolean;
  }
): ValidationResult & { 
  normalizedPlayerAnswer: any;
  correctAnswer: any;
  answerFormat: AnswerFormat;
} {
  const format = getAnswerFormat(questionType);
  
  // Extract correct answer in proper format
  const correctAnswer = extractCorrectAnswer(questionType, options, settingsJson);
  
  // Normalize player answer
  const normalizedPlayerAnswer = normalizePlayerAnswer(questionType, playerAnswer);
  
  // Validate and score
  const { isCorrect, scorePercentage } = validateAndScorePercentage(
    questionType,
    normalizedPlayerAnswer,
    correctAnswer,
    {
      allOptions: options,
      estimationMargin: scoringOptions?.estimationMargin,
      acceptableAnswers: scoringOptions?.acceptableAnswers,
    }
  );
  
  // Calculate final score with bonuses
  const config: ScoringConfig = {
    basePoints: scoringOptions?.basePoints || 10,
    streakBonus: scoringOptions?.streakBonusEnabled ?? true,
    streakBonusPoints: scoringOptions?.streakBonusPoints ?? 1,
    speedPodiumEnabled: scoringOptions?.speedPodiumEnabled ?? false,
  };
  
  const score = calculateScore(
    scorePercentage,
    config,
    scoringOptions?.timeSpentMs,
    scoringOptions?.timeLimitMs,
    scoringOptions?.currentStreak
  );
  
  return {
    isCorrect,
    score,
    scorePercentage,
    normalizedPlayerAnswer,
    correctAnswer,
    answerFormat: format,
  };
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
 * NOTE: When speedPodiumEnabled is true, time bonus is NOT applied here.
 *       Speed podium bonuses are calculated separately in the WS server
 *       after all answers are collected (when the item is locked).
 */
export function calculateScore(
  scorePercentage: number,
  config: ScoringConfig,
  _timeSpentMs?: number,
  _timeLimitMs?: number,
  currentStreak?: number
): number {
  // Base score from percentage
  let score = Math.round((scorePercentage / 100) * config.basePoints);
  
  // No bonuses if no points earned
  if (score === 0) return 0;

  // Speed Podium bonus is calculated separately in processSpeedPodiumBonuses()
  // after question lock, not here per-answer

  // Streak bonus (if enabled) - only for fully correct answers
  if (config.streakBonus && currentStreak !== undefined && currentStreak > 0 && scorePercentage === 100) {
    const streakBonus = config.streakBonusPoints * currentStreak;
    score += streakBonus;
  }

  return Math.max(0, Math.round(score));
}

/**
 * Calculate speed podium bonus for a single player
 * Only called for players with 100% correct answers
 * @param position - 1, 2, or 3 (podium position)
 * @param baseScore - The score earned without bonuses
 * @param percentages - Podium percentages (first, second, third)
 * @returns The bonus points to add
 */
export function calculateSpeedPodiumBonus(
  position: 1 | 2 | 3,
  baseScore: number,
  percentages: { first: number; second: number; third: number } = DEFAULT_SPEED_PODIUM_PERCENTAGES
): number {
  const percentageMap: Record<1 | 2 | 3, number> = {
    1: percentages.first,
    2: percentages.second,
    3: percentages.third,
  };
  
  const percentage = percentageMap[position];
  return Math.round(baseScore * (percentage / 100));
}

/**
 * Calculate speed podium results for all players who got 100% correct
 * Returns an array of podium results sorted by position (1st, 2nd, 3rd)
 * Only top 3 get podium bonuses
 * 
 * @param answers - Array of player answers with { playerId, score, scorePercentage, timeSpentMs }
 * @param percentages - Podium percentages (first, second, third)
 * @returns Array of SpeedPodiumResult for players who earn podium bonus
 */
export function calculateSpeedPodium(
  answers: Array<{
    playerId: string;
    score: number;
    scorePercentage: number;
    timeSpentMs: number;
  }>,
  percentages: { first: number; second: number; third: number } = DEFAULT_SPEED_PODIUM_PERCENTAGES
): SpeedPodiumResult[] {
  // Filter to only 100% correct answers
  const perfectAnswers = answers.filter(a => a.scorePercentage === 100);
  
  if (perfectAnswers.length === 0) {
    return [];
  }
  
  // Sort by time spent (fastest first)
  const sorted = [...perfectAnswers].sort((a, b) => a.timeSpentMs - b.timeSpentMs);
  
  // Take top 3 and calculate bonuses
  const results: SpeedPodiumResult[] = [];
  
  for (let i = 0; i < Math.min(3, sorted.length); i++) {
    const answer = sorted[i];
    const position = (i + 1) as 1 | 2 | 3;
    const bonusPoints = calculateSpeedPodiumBonus(position, answer.score, percentages);
    const bonusPercentage = position === 1 ? percentages.first : position === 2 ? percentages.second : percentages.third;
    
    results.push({
      playerId: answer.playerId,
      position,
      baseScore: answer.score,
      bonusPercentage,
      bonusPoints,
      finalScore: answer.score + bonusPoints,
      timeSpentMs: answer.timeSpentMs,
    });
  }
  
  return results;
}

/**
 * Get default scoring config for a question type
 */
export function getDefaultScoringConfig(_questionType: string): ScoringConfig {
  return {
    basePoints: 10, // Default from user settings
    streakBonus: true,
    streakBonusPoints: 1, // 1 point per streak
    speedPodiumEnabled: false,
  };
}

/**
 * Get default quiz scoring settings
 */
export function getDefaultQuizScoringSettings(): QuizScoringSettings {
  return {
    streakBonus: true,
    streakBonusPoints: 1,
    speedPodiumEnabled: false,
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
