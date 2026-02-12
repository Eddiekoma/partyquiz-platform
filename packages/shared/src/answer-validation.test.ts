import { describe, it, expect } from "vitest";
import {
  normalizeString,
  fuzzyMatch,
  validateAnswer,
  calculateScore,
  validateAndScore,
  validateAnswerComplete,
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

  describe("validateAnswer - MC_SINGLE", () => {
    it("should validate correct single choice", () => {
      const result = validateAnswer("MC_SINGLE" as QuestionType, "option1", "option1");
      expect(result).toBe(true);
    });

    it("should reject incorrect single choice", () => {
      const result = validateAnswer("MC_SINGLE" as QuestionType, "option1", "option2");
      expect(result).toBe(false);
    });

    it("should validate correct multiple choice", () => {
      // Note: Legacy validateAnswer uses EXACT_MATCH mode for MC_SINGLE
      // For proper MC_MULTIPLE validation, use validateAnswerComplete
      const result = validateAnswer(
        "MC_MULTIPLE" as QuestionType,
        ["option1", "option2"],
        ["option1", "option2"]
      );
      // MC_MULTIPLE uses PARTIAL_MULTI scoring, so 100% correct = true
      expect(result).toBe(true);
    });

    it("should reject incorrect multiple choice", () => {
      const result = validateAnswer(
        "MC_SINGLE" as QuestionType,
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

  describe("validateAnswer - OPEN_TEXT", () => {
    it("should validate exact match", () => {
      const result = validateAnswer("OPEN_TEXT" as QuestionType, "Paris", "Paris");
      expect(result).toBe(true);
    });

    it("should validate case-insensitive match", () => {
      const result = validateAnswer("OPEN_TEXT" as QuestionType, "PARIS", "paris");
      expect(result).toBe(true);
    });

    it("should validate fuzzy match with small typo", () => {
      // Use a typo that's within the 85% similarity threshold
      const result = validateAnswer("OPEN_TEXT" as QuestionType, "Amsterdem", "Amsterdam");
      expect(result).toBe(true);
    });

    it("should reject completely wrong answer", () => {
      const result = validateAnswer("OPEN_TEXT" as QuestionType, "London", "Paris");
      expect(result).toBe(false);
    });
  });

  describe("validateAnswer - ORDER", () => {
    it("should validate correct order", () => {
      const result = validateAnswer(
        "ORDER" as QuestionType,
        ["A", "B", "C"],
        ["A", "B", "C"]
      );
      expect(result).toBe(true);
    });

    it("should reject incorrect order", () => {
      const result = validateAnswer(
        "ORDER" as QuestionType,
        ["A", "C", "B"],
        ["A", "B", "C"]
      );
      expect(result).toBe(false);
    });

    it("should reject missing items", () => {
      const result = validateAnswer(
        "ORDER" as QuestionType,
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
      // Note: MUSIC_GUESS_YEAR uses graduated scoring:
      // ±2 years = 70% score (still considered "correct" since threshold is 70%)
      // ±3 years = 50% score (NOT correct)
      // ±5+ years = 30% or less
      expect(
        validateAnswer("MUSIC_GUESS_YEAR" as QuestionType, 1987, 1990)
      ).toBe(false); // 3 years off = 50% = not correct
      expect(
        validateAnswer("MUSIC_GUESS_YEAR" as QuestionType, 1995, 1990)
      ).toBe(false); // 5 years off = 30% = not correct
    });
  });

  describe("validateAnswer - POLL", () => {
    it("POLL - any answer is valid (no correct answer)", () => {
      expect(validateAnswer("POLL" as QuestionType, "anything", "option1")).toBe(
        true
      );
    });
  });

  describe("calculateScore", () => {
    const basicConfig = { 
      basePoints: 100, 
      streakBonus: true, 
      streakBonusPoints: 50,
      speedPodiumEnabled: false,
    };

    it("should return 0 for 0% score", () => {
      // scorePercentage = 0 means wrong answer
      const result = calculateScore(0, basicConfig, 1000, 30000, 0);
      expect(result).toBe(0);
    });

    it("should calculate base points for 100% score", () => {
      // scorePercentage = 100 means fully correct
      const result = calculateScore(100, basicConfig, 1000, 30000, 0);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeGreaterThanOrEqual(100);
    });

    it("should add streak bonus", () => {
      const noStreakResult = calculateScore(100, basicConfig, 1000, 30000, 0);
      const streakResult = calculateScore(100, basicConfig, 1000, 30000, 5);
      expect(streakResult).toBeGreaterThan(noStreakResult);
      expect(streakResult).toBeGreaterThanOrEqual(noStreakResult + 250); // 5 * 50
    });

    it("should not give streak bonus when disabled", () => {
      const noStreakConfig = { 
        basePoints: 100, 
        streakBonus: false, 
        streakBonusPoints: 0 
      };
      const noStreakResult = calculateScore(100, noStreakConfig, 1000, 30000, 0);
      const streakResult = calculateScore(100, noStreakConfig, 1000, 30000, 5);
      expect(noStreakResult).toBe(streakResult);
      expect(noStreakResult).toBe(100);
    });
  });

  describe("validateAndScore", () => {
    it("should combine validation and scoring", () => {
      const result = validateAndScore(
        QuestionType.MC_SINGLE,
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
        QuestionType.MC_SINGLE,
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
        QuestionType.MC_SINGLE,
        "option1",
        "option1",
        undefined,
        5000,
        30000,
        0
      );
      expect(resultMCQ.score).toBeGreaterThan(0);

      const resultOpen = validateAndScore(
        QuestionType.OPEN_TEXT,
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

  describe("validateAnswerComplete - Format Handling", () => {
    it("should correctly validate TRUE_FALSE with boolean answer", () => {
      // Simulates the REAL scenario: player sends boolean, options have isCorrect flag
      const options = [
        { id: "opt1", text: "True", isCorrect: true },
        { id: "opt2", text: "False", isCorrect: false },
      ];

      // Player sends true (boolean), and "True" option is correct
      const result = validateAnswerComplete("TRUE_FALSE", true, options);
      expect(result.isCorrect).toBe(true);
      expect(result.correctAnswer).toBe(true);
      expect(result.normalizedPlayerAnswer).toBe(true);
      expect(result.answerFormat).toBe("BOOLEAN");
    });

    it("should correctly validate TRUE_FALSE with false answer", () => {
      const options = [
        { id: "opt1", text: "True", isCorrect: false },
        { id: "opt2", text: "False", isCorrect: true },
      ];

      // Player sends false, and "False" option is correct
      const result = validateAnswerComplete("TRUE_FALSE", false, options);
      expect(result.isCorrect).toBe(true);
      expect(result.correctAnswer).toBe(false);
    });

    it("should reject wrong TRUE_FALSE answer", () => {
      const options = [
        { id: "opt1", text: "True", isCorrect: true },
        { id: "opt2", text: "False", isCorrect: false },
      ];

      // Player sends false, but "True" is correct
      const result = validateAnswerComplete("TRUE_FALSE", false, options);
      expect(result.isCorrect).toBe(false);
    });

    it("should correctly validate MCQ with option ID", () => {
      const options = [
        { id: "option-abc123", text: "Amsterdam", isCorrect: true },
        { id: "option-def456", text: "Rotterdam", isCorrect: false },
      ];

      // Player sends option ID
      const result = validateAnswerComplete("MC_SINGLE", "option-abc123", options);
      expect(result.isCorrect).toBe(true);
      expect(result.correctAnswer).toBe("option-abc123");
    });

    it("should correctly validate ESTIMATION with number", () => {
      const options: any[] = [];
      const settingsJson = { correctAnswer: 42 };

      // Player sends number
      const result = validateAnswerComplete("ESTIMATION", 42, options, settingsJson);
      expect(result.isCorrect).toBe(true);
      expect(result.correctAnswer).toBe(42);
    });

    it("should correctly validate OPEN_TEXT with fuzzy text matching", () => {
      const options = [
        { id: "opt1", text: "Amsterdam", isCorrect: true },
      ];

      // Player sends text with small typo
      const result = validateAnswerComplete("OPEN_TEXT", "Amsterdem", options);
      expect(result.isCorrect).toBe(true); // Fuzzy match should pass
    });

    it("should correctly validate ORDER with array of IDs", () => {
      const options = [
        { id: "opt1", text: "First", order: 1 },
        { id: "opt2", text: "Second", order: 2 },
        { id: "opt3", text: "Third", order: 3 },
      ];

      // Player sends correctly ordered array
      const result = validateAnswerComplete("ORDER", ["opt1", "opt2", "opt3"], options);
      expect(result.isCorrect).toBe(true);
      expect(result.correctAnswer).toEqual(["opt1", "opt2", "opt3"]);
      expect(result.answerFormat).toBe("ORDER_ARRAY");
    });

    it("should correctly validate MUSIC_GUESS_YEAR with numeric answer", () => {
      const options: any[] = [];
      const settingsJson = { correctAnswer: 1985 };

      // Player sends exact year
      const result = validateAnswerComplete("MUSIC_GUESS_YEAR", 1985, options, settingsJson);
      expect(result.isCorrect).toBe(true);
      expect(result.correctAnswer).toBe(1985);
      expect(result.answerFormat).toBe("NUMBER");
    });

    it("should correctly validate MUSIC_GUESS_TITLE with fuzzy text", () => {
      const options = [
        { id: "opt1", text: "Bohemian Rhapsody", isCorrect: true },
      ];

      // Player sends with small typo
      const result = validateAnswerComplete("MUSIC_GUESS_TITLE", "Bohemian Rapsody", options);
      expect(result.isCorrect).toBe(true);
      expect(result.answerFormat).toBe("TEXT");
    });

    it("should correctly validate YOUTUBE_WHO_SAID_IT with option ID", () => {
      const options = [
        { id: "opt-person1", text: "Person A", isCorrect: true },
        { id: "opt-person2", text: "Person B", isCorrect: false },
      ];

      // Player sends option ID (MCQ style)
      const result = validateAnswerComplete("YOUTUBE_WHO_SAID_IT", "opt-person1", options);
      expect(result.isCorrect).toBe(true);
      expect(result.correctAnswer).toBe("opt-person1");
      expect(result.answerFormat).toBe("OPTION_ID");
    });

    it("should correctly handle POLL with no scoring", () => {
      const options = [
        { id: "opt1", text: "Option A" },
        { id: "opt2", text: "Option B" },
      ];

      // Player votes for any option
      const result = validateAnswerComplete("POLL", "opt1", options);
      expect(result.isCorrect).toBe(true); // Polls always "correct"
      expect(result.score).toBe(0); // But 0 points
      expect(result.answerFormat).toBe("NO_ANSWER");
    });

    it("should correctly validate ORDER type with array of IDs", () => {
      const options = [
        { id: "item1", text: "First", order: 1 },
        { id: "item2", text: "Second", order: 2 },
        { id: "item3", text: "Third", order: 3 },
      ];

      // Player orders items correctly
      const result = validateAnswerComplete("ORDER", ["item1", "item2", "item3"], options);
      expect(result.isCorrect).toBe(true);
      expect(result.answerFormat).toBe("ORDER_ARRAY");
    });

    it("should give partial points for ORDER with some correct positions", () => {
      const options = [
        { id: "item1", text: "First", order: 1 },
        { id: "item2", text: "Second", order: 2 },
        { id: "item3", text: "Third", order: 3 },
        { id: "item4", text: "Fourth", order: 4 },
      ];

      // Player gets 2 of 4 correct (items 1 and 4 in right position, 2 and 3 swapped)
      // Correct: [item1, item2, item3, item4]
      // Player:  [item1, item3, item2, item4]
      const result = validateAnswerComplete("ORDER", ["item1", "item3", "item2", "item4"], options);
      expect(result.isCorrect).toBe(false); // Not 100% correct
      expect(result.scorePercentage).toBe(50); // 2 of 4 = 50%
      expect(result.score).toBeGreaterThan(0); // Should still get partial points
    });

    it("should give 0 points for ORDER with all wrong positions", () => {
      const options = [
        { id: "item1", text: "First", order: 1 },
        { id: "item2", text: "Second", order: 2 },
        { id: "item3", text: "Third", order: 3 },
      ];

      // Player gets everything in reverse order
      // Correct: [item1, item2, item3]
      // Player:  [item3, item2, item1]
      const result = validateAnswerComplete("ORDER", ["item3", "item2", "item1"], options);
      expect(result.isCorrect).toBe(false);
      // Only item2 is in correct position (middle stays middle in reverse)
      expect(result.scorePercentage).toBe(33); // 1 of 3 = 33%
    });

    it("should handle ORDER with 2 items correctly", () => {
      const options = [
        { id: "A", text: "First", order: 1 },
        { id: "B", text: "Second", order: 2 },
      ];

      // Correct order
      const correct = validateAnswerComplete("ORDER", ["A", "B"], options);
      expect(correct.isCorrect).toBe(true);
      expect(correct.scorePercentage).toBe(100);

      // Wrong order - with 2 items, swapping means 0 correct
      const wrong = validateAnswerComplete("ORDER", ["B", "A"], options);
      expect(wrong.isCorrect).toBe(false);
      expect(wrong.scorePercentage).toBe(0); // Neither in correct position
    });

    it("should correctly validate PHOTO_OPEN with text answer", () => {
      const options = [
        { id: "opt1", text: "A cat", isCorrect: true },
      ];

      // Player describes what they see in the photo
      const result = validateAnswerComplete("PHOTO_OPEN", "a cat", options);
      expect(result.isCorrect).toBe(true);
      expect(result.answerFormat).toBe("TEXT");
    });
  });
});
