import { describe, it, expect } from "vitest";
import {
  normalizeString,
  fuzzyMatch,
  validateAnswer,
  calculateScore,
  validateAndScore,
} from "./answer-validation";
import { QuestionType } from "./types";

describe("Answer Validation", () => {
  describe("normalizeString", () => {
    it("should convert to lowercase", () => {
      expect(normalizeString("HELLO")).toBe("hello");
    });

    it("should trim whitespace", () => {
      expect(normalizeString("  hello  ")).toBe("hello");
    });

    it("should normalize multiple spaces", () => {
      expect(normalizeString("hello   world")).toBe("hello world");
    });

    it("should handle multiple spaces", () => {
      expect(normalizeString("hello    world    !")).toBe("hello world !");
    });
  });

  describe("fuzzyMatch", () => {
    it("should match exact strings", () => {
      expect(fuzzyMatch("hello", "hello")).toBe(true);
    });

    it("should match case-insensitive", () => {
      expect(fuzzyMatch("HELLO", "hello")).toBe(true);
    });

    it("should not match very different strings", () => {
      expect(fuzzyMatch("hello", "goodbye", 85)).toBe(false);
    });

    it("should handle empty strings", () => {
      expect(fuzzyMatch("", "")).toBe(true);
      expect(fuzzyMatch("hello", "")).toBe(false);
    });
  });

  describe("validateAnswer - MCQ", () => {
    it("should validate correct single choice", () => {
      const result = validateAnswer("MCQ" as QuestionType, "option1", "option1");
      expect(result).toBe(true);
    });

    it("should reject incorrect single choice", () => {
      const result = validateAnswer("MCQ" as QuestionType, "option1", "option2");
      expect(result).toBe(false);
    });

    it("should validate correct multiple choice", () => {
      const result = validateAnswer(
        "MCQ" as QuestionType,
        ["option1", "option2"],
        ["option1", "option2"]
      );
      expect(result).toBe(true);
    });

    it("should reject incorrect multiple choice", () => {
      const result = validateAnswer(
        "MCQ" as QuestionType,
        ["option1"],
        ["option1", "option2"]
      );
      expect(result).toBe(false);
    });
  });

  describe("validateAnswer - TRUE_FALSE", () => {
    it("should validate correct true answer", () => {
      const result = validateAnswer("TRUE_FALSE" as QuestionType, true, true);
      expect(result).toBe(true);
    });

    it("should validate correct false answer", () => {
      const result = validateAnswer("TRUE_FALSE" as QuestionType, false, false);
      expect(result).toBe(true);
    });

    it("should reject incorrect answer", () => {
      const result = validateAnswer("TRUE_FALSE" as QuestionType, true, false);
      expect(result).toBe(false);
    });
  });

  describe("validateAnswer - OPEN", () => {
    it("should validate exact match", () => {
      const result = validateAnswer("OPEN" as QuestionType, "Paris", "Paris");
      expect(result).toBe(true);
    });

    it("should validate case-insensitive match", () => {
      const result = validateAnswer("OPEN" as QuestionType, "PARIS", "paris");
      expect(result).toBe(true);
    });

    it("should validate fuzzy match with small typo", () => {
      // Use a typo that's within the 85% similarity threshold
      const result = validateAnswer("OPEN" as QuestionType, "Amsterdem", "Amsterdam");
      expect(result).toBe(true);
    });

    it("should reject completely wrong answer", () => {
      const result = validateAnswer("OPEN" as QuestionType, "London", "Paris");
      expect(result).toBe(false);
    });
  });

  describe("validateAnswer - ORDERING", () => {
    it("should validate correct order", () => {
      const result = validateAnswer(
        "ORDERING" as QuestionType,
        ["A", "B", "C"],
        ["A", "B", "C"]
      );
      expect(result).toBe(true);
    });

    it("should reject incorrect order", () => {
      const result = validateAnswer(
        "ORDERING" as QuestionType,
        ["A", "C", "B"],
        ["A", "B", "C"]
      );
      expect(result).toBe(false);
    });

    it("should reject missing items", () => {
      const result = validateAnswer(
        "ORDERING" as QuestionType,
        ["A", "B"],
        ["A", "B", "C"]
      );
      expect(result).toBe(false);
    });
  });

  describe("validateAnswer - MUSIC_GUESS_YEAR", () => {
    it("should validate exact year", () => {
      const result = validateAnswer(
        "MUSIC_GUESS_YEAR" as QuestionType,
        1990,
        1990
      );
      expect(result).toBe(true);
    });

    it("should validate year within 1 year tolerance", () => {
      expect(
        validateAnswer("MUSIC_GUESS_YEAR" as QuestionType, 1989, 1990)
      ).toBe(true);
      expect(
        validateAnswer("MUSIC_GUESS_YEAR" as QuestionType, 1991, 1990)
      ).toBe(true);
    });

    it("should reject year outside tolerance", () => {
      expect(
        validateAnswer("MUSIC_GUESS_YEAR" as QuestionType, 1988, 1990)
      ).toBe(false);
      expect(
        validateAnswer("MUSIC_GUESS_YEAR" as QuestionType, 1992, 1990)
      ).toBe(false);
    });
  });

  describe("validateAnswer - POLL/EMOJI_VOTE/CHAOS_EVENT", () => {
    it("POLL - any answer is valid", () => {
      expect(validateAnswer("POLL" as QuestionType, "anything", "option1")).toBe(
        true
      );
    });

    it("EMOJI_VOTE - any emoji is valid", () => {
      expect(
        validateAnswer("EMOJI_VOTE" as QuestionType, "👍", "👎")
      ).toBe(true);
    });

    it("CHAOS_EVENT - any input is valid", () => {
      expect(
        validateAnswer("CHAOS_EVENT" as QuestionType, 123, "anything")
      ).toBe(true);
    });
  });

  describe("calculateScore", () => {
    const basicConfig = { basePoints: 100, timeBonus: true, streakBonus: 50 };

    it("should return 0 for incorrect answer", () => {
      const result = calculateScore(false, basicConfig, 1000, 30000, 0);
      expect(result).toBe(0);
    });

    it("should calculate base points for correct answer", () => {
      const result = calculateScore(true, basicConfig, 1000, 30000, 0);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeGreaterThanOrEqual(100);
    });

    it("should add time bonus for fast answers", () => {
      const fastResult = calculateScore(true, basicConfig, 1000, 30000, 0);
      const slowResult = calculateScore(true, basicConfig, 25000, 30000, 0);
      expect(fastResult).toBeGreaterThan(slowResult);
    });

    it("should add streak bonus", () => {
      const noStreakResult = calculateScore(true, basicConfig, 1000, 30000, 0);
      const streakResult = calculateScore(true, basicConfig, 1000, 30000, 5);
      expect(streakResult).toBeGreaterThan(noStreakResult);
      expect(streakResult).toBeGreaterThanOrEqual(noStreakResult + 250); // 5 * 50
    });

    it("should not give time bonus when disabled", () => {
      const noTimeBonusConfig = { basePoints: 100, timeBonus: false, streakBonus: 0 };
      const fastResult = calculateScore(true, noTimeBonusConfig, 1000, 30000, 0);
      const slowResult = calculateScore(true, noTimeBonusConfig, 25000, 30000, 0);
      expect(fastResult).toBe(slowResult);
      expect(fastResult).toBe(100);
    });
  });

  describe("validateAndScore", () => {
    it("should combine validation and scoring", () => {
      const result = validateAndScore(
        QuestionType.MCQ,
        "option1",
        "option1",
        100,
        5000,
        30000,
        2
      );
      expect(result.isCorrect).toBe(true);
      expect(result.score).toBeGreaterThan(100);
    });

    it("should return 0 score for incorrect answer", () => {
      const result = validateAndScore(
        QuestionType.MCQ,
        "option1",
        "option2",
        100,
        5000,
        30000,
        2
      );
      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(0);
    });

    it("should use default scoring config for question type", () => {
      const resultMCQ = validateAndScore(
        QuestionType.MCQ,
        "option1",
        "option1",
        undefined,
        5000,
        30000,
        0
      );
      expect(resultMCQ.score).toBeGreaterThan(0);

      const resultOpen = validateAndScore(
        QuestionType.OPEN,
        "Paris",
        "Paris",
        undefined,
        5000,
        30000,
        0
      );
      expect(resultOpen.score).toBeGreaterThan(0);
    });
  });
});
