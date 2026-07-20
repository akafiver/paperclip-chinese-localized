import { describe, expect, it } from "vitest";

import {
  PRODUCTIVITY_REVIEW_AUTOMATION_POLICY,
  shouldCreateProductivityReviewForEvidence,
} from "./productivity-review.js";

describe("PRODUCTIVITY_REVIEW_AUTOMATION_POLICY", () => {
  it("keeps productivity reviews as board-visible review work instead of automatic agent work", () => {
    expect(PRODUCTIVITY_REVIEW_AUTOMATION_POLICY).toEqual({
      owner: "unassigned_board_review",
      enqueueAgentWakeup: false,
    });
  });
});

describe("shouldCreateProductivityReviewForEvidence", () => {
  it("does not create manager review work while the source issue already has active execution", () => {
    expect(shouldCreateProductivityReviewForEvidence({ activeRunCount: 1 })).toBe(false);
    expect(shouldCreateProductivityReviewForEvidence({ activeRunCount: 2 })).toBe(false);
  });

  it("allows review creation once the source issue has no queued or running execution", () => {
    expect(shouldCreateProductivityReviewForEvidence({ activeRunCount: 0 })).toBe(true);
  });
});
