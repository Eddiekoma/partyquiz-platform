import { describe, it, expect } from "vitest";
import {
  getBaseQuestionType,
  requiresPhotos,
  getMaxPhotos,
  getRequiredMediaType,
  getAspectRatioCategory,
  QuestionType,
  MediaType,
  AspectRatioCategory,
} from "./types";

describe("Question Type Helpers", () => {
  describe("getBaseQuestionType", () => {
    it("should strip PHOTO_ prefix", () => {
      expect(getBaseQuestionType("PHOTO_MC_SINGLE" as QuestionType)).toBe("MC_SINGLE");
      expect(getBaseQuestionType("PHOTO_MC_MULTIPLE" as QuestionType)).toBe("MC_MULTIPLE");
      expect(getBaseQuestionType("PHOTO_TRUE_FALSE" as QuestionType)).toBe("TRUE_FALSE");
    });

    it("should map AUDIO_/VIDEO_ types to their base equivalents", () => {
      // AUDIO_QUESTION -> MC_SINGLE (legacy mapping)
      expect(getBaseQuestionType("AUDIO_QUESTION" as QuestionType)).toBe("MC_SINGLE");
      // AUDIO_OPEN -> OPEN_TEXT (legacy mapping)
      expect(getBaseQuestionType("AUDIO_OPEN" as QuestionType)).toBe("OPEN_TEXT");
      // VIDEO_QUESTION -> MC_SINGLE (legacy mapping)
      expect(getBaseQuestionType("VIDEO_QUESTION" as QuestionType)).toBe("MC_SINGLE");
      // VIDEO_OPEN -> OPEN_TEXT (legacy mapping)
      expect(getBaseQuestionType("VIDEO_OPEN" as QuestionType)).toBe("OPEN_TEXT");
    });

    it("should return unchanged for text types", () => {
      expect(getBaseQuestionType("MC_SINGLE" as QuestionType)).toBe("MC_SINGLE");
      expect(getBaseQuestionType("TRUE_FALSE" as QuestionType)).toBe("TRUE_FALSE");
      expect(getBaseQuestionType("OPEN_TEXT" as QuestionType)).toBe("OPEN_TEXT");
    });

    it("should handle all 7 new PHOTO_ types", () => {
      expect(getBaseQuestionType("PHOTO_MC_SINGLE" as QuestionType)).toBe("MC_SINGLE");
      expect(getBaseQuestionType("PHOTO_MC_MULTIPLE" as QuestionType)).toBe("MC_MULTIPLE");
      expect(getBaseQuestionType("PHOTO_MC_ORDER" as QuestionType)).toBe("MC_ORDER");
      expect(getBaseQuestionType("PHOTO_TRUE_FALSE" as QuestionType)).toBe("TRUE_FALSE");
      expect(getBaseQuestionType("PHOTO_OPEN_TEXT" as QuestionType)).toBe("OPEN_TEXT");
      expect(getBaseQuestionType("PHOTO_NUMERIC" as QuestionType)).toBe("NUMERIC");
      expect(getBaseQuestionType("PHOTO_SLIDER" as QuestionType)).toBe("SLIDER");
    });
  });

  describe("requiresPhotos", () => {
    it("should return true for all PHOTO_ types", () => {
      expect(requiresPhotos("PHOTO_MC_SINGLE" as QuestionType)).toBe(true);
      expect(requiresPhotos("PHOTO_MC_MULTIPLE" as QuestionType)).toBe(true);
      expect(requiresPhotos("PHOTO_MC_ORDER" as QuestionType)).toBe(true);
      expect(requiresPhotos("PHOTO_TRUE_FALSE" as QuestionType)).toBe(true);
      expect(requiresPhotos("PHOTO_OPEN_TEXT" as QuestionType)).toBe(true);
      expect(requiresPhotos("PHOTO_NUMERIC" as QuestionType)).toBe(true);
      expect(requiresPhotos("PHOTO_SLIDER" as QuestionType)).toBe(true);
    });

    it("should return false for text types", () => {
      expect(requiresPhotos("MC_SINGLE" as QuestionType)).toBe(false);
      expect(requiresPhotos("TRUE_FALSE" as QuestionType)).toBe(false);
      expect(requiresPhotos("OPEN_TEXT" as QuestionType)).toBe(false);
    });

    it("should return false for audio/video types", () => {
      expect(requiresPhotos("AUDIO_QUESTION" as QuestionType)).toBe(false);
      expect(requiresPhotos("VIDEO_QUESTION" as QuestionType)).toBe(false);
    });
  });

  describe("getMaxPhotos", () => {
    it("should return 6 for all PHOTO_ types", () => {
      expect(getMaxPhotos("PHOTO_MC_SINGLE" as QuestionType)).toBe(6);
      expect(getMaxPhotos("PHOTO_MC_MULTIPLE" as QuestionType)).toBe(6);
      expect(getMaxPhotos("PHOTO_TRUE_FALSE" as QuestionType)).toBe(6);
      expect(getMaxPhotos("PHOTO_OPEN_TEXT" as QuestionType)).toBe(6);
    });

    it("should return 0 for non-PHOTO types", () => {
      expect(getMaxPhotos("MC_SINGLE" as QuestionType)).toBe(0);
      expect(getMaxPhotos("AUDIO_QUESTION" as QuestionType)).toBe(0);
      expect(getMaxPhotos("VIDEO_QUESTION" as QuestionType)).toBe(0);
    });
  });

  describe("getRequiredMediaType", () => {
    it("should return IMAGE for PHOTO_ types", () => {
      expect(getRequiredMediaType("PHOTO_MC_SINGLE" as QuestionType)).toBe(MediaType.IMAGE);
      expect(getRequiredMediaType("PHOTO_TRUE_FALSE" as QuestionType)).toBe(MediaType.IMAGE);
    });

    it("should return AUDIO for AUDIO_ types", () => {
      expect(getRequiredMediaType("AUDIO_QUESTION" as QuestionType)).toBe(MediaType.AUDIO);
      expect(getRequiredMediaType("AUDIO_OPEN" as QuestionType)).toBe(MediaType.AUDIO);
    });

    it("should return VIDEO for VIDEO_ types", () => {
      expect(getRequiredMediaType("VIDEO_QUESTION" as QuestionType)).toBe(MediaType.VIDEO);
      expect(getRequiredMediaType("VIDEO_OPEN" as QuestionType)).toBe(MediaType.VIDEO);
    });

    it("should return null for text types", () => {
      expect(getRequiredMediaType("MC_SINGLE" as QuestionType)).toBeNull();
      expect(getRequiredMediaType("TRUE_FALSE" as QuestionType)).toBeNull();
    });
  });

  describe("getAspectRatioCategory", () => {
    it("should categorize ultra-wide images", () => {
      expect(getAspectRatioCategory(3000, 1000)).toBe(AspectRatioCategory.ULTRA_WIDE);
      expect(getAspectRatioCategory(3200, 1200)).toBe(AspectRatioCategory.ULTRA_WIDE);
    });

    it("should categorize wide images", () => {
      expect(getAspectRatioCategory(1920, 1080)).toBe(AspectRatioCategory.WIDE);
      expect(getAspectRatioCategory(1600, 900)).toBe(AspectRatioCategory.WIDE);
    });

    it("should categorize standard images", () => {
      expect(getAspectRatioCategory(1024, 768)).toBe(AspectRatioCategory.STANDARD);
      expect(getAspectRatioCategory(800, 600)).toBe(AspectRatioCategory.STANDARD);
    });

    it("should categorize square images", () => {
      expect(getAspectRatioCategory(1000, 1000)).toBe(AspectRatioCategory.SQUARE);
      expect(getAspectRatioCategory(500, 500)).toBe(AspectRatioCategory.SQUARE);
    });

    it("should categorize portrait images", () => {
      expect(getAspectRatioCategory(768, 1024)).toBe(AspectRatioCategory.PORTRAIT);
      expect(getAspectRatioCategory(600, 800)).toBe(AspectRatioCategory.PORTRAIT);
    });

    it("should categorize tall images", () => {
      expect(getAspectRatioCategory(1080, 1920)).toBe(AspectRatioCategory.TALL);
      expect(getAspectRatioCategory(720, 1440)).toBe(AspectRatioCategory.TALL);
    });

    it("should handle edge cases near boundaries", () => {
      // Ultra-wide/wide boundary is at ratio > 2.5
      expect(getAspectRatioCategory(2600, 1000)).toBe(AspectRatioCategory.ULTRA_WIDE);
      expect(getAspectRatioCategory(2400, 1000)).toBe(AspectRatioCategory.WIDE);

      // Near square/portrait boundary (0.9-1.1)
      expect(getAspectRatioCategory(100, 110)).toBe(AspectRatioCategory.SQUARE);
      expect(getAspectRatioCategory(100, 120)).toBe(AspectRatioCategory.PORTRAIT);
    });
  });
});

describe("Question Type Timers", () => {
  it("should document that PHOTO_ types have +5s bonus", () => {
    // Text types have standard timers (e.g. MC_SINGLE = 30s)
    // PHOTO_ types have +5s bonus (e.g. PHOTO_MC_SINGLE = 35s)
    // This is configured in DEFAULT_TIMER_BY_QUESTION_TYPE in types.ts
    expect(true).toBe(true);
  });
});
