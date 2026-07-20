import { describe, expect, it } from "vitest";

import { shouldCreateProductivityReviewForEvidence } from "./productivity-review.js";

describe("shouldCreateProductivityReviewForEvidence", () => {
  it("does not create manager review work while the source issue already has active execution", () => {
    expect(shouldCreateProductivityReviewForEvidence({ activeRunCount: 1 })).toBe(false);
    expect(shouldCreateProductivityReviewForEvidence({ activeRunCount: 2 })).toBe(false);
  });

  it("allows review creation once the source issue has no queued or running execution", () => {
    expect(shouldCreateProductivityReviewForEvidence({ activeRunCount: 0 })).toBe(true);
  });
});
