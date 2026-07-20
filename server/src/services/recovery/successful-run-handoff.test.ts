import { describe, expect, it } from "vitest";

import {
  decideSuccessfulRunHandoff,
  FINISH_SUCCESSFUL_RUN_HANDOFF_REASON,
  SUCCESSFUL_RUN_MISSING_STATE_REASON,
} from "./successful-run-handoff.js";

describe("decideSuccessfulRunHandoff", () => {
  it("queues a status-only corrective wake without implicit continuation intent", () => {
    const decision = decideSuccessfulRunHandoff({
      run: {
        id: "run-1",
        companyId: "company-1",
        agentId: "agent-1",
        status: "succeeded",
        contextSnapshot: {},
        issueCommentStatus: null,
      } as never,
      issue: {
        id: "issue-1",
        companyId: "company-1",
        identifier: "GMUA-1",
        title: "Boundary acceptance",
        status: "in_progress",
        assigneeAgentId: "agent-1",
        assigneeUserId: null,
        executionState: null,
      },
      agent: {
        id: "agent-1",
        companyId: "company-1",
        status: "active",
      },
      livenessState: "completed",
      detectedProgressSummary: "wrote the requested workspace artifact",
      taskKey: "issue-1",
      hasActiveExecutionPath: false,
      hasQueuedWake: false,
      hasPendingInteractionOrApproval: false,
      hasPersistedMonitor: false,
      hasExplicitBlockerPath: false,
      hasOpenRecoveryIssue: false,
      hasPauseHold: false,
      hasActiveRoutineContinuation: false,
      budgetBlocked: false,
      idempotentWakeExists: false,
    });

    expect(decision.kind).toBe("enqueue");
    if (decision.kind !== "enqueue") return;
    expect(decision.payload).toMatchObject({
      handoffRequired: true,
      handoffReason: SUCCESSFUL_RUN_MISSING_STATE_REASON,
      sourceRunId: "run-1",
    });
    expect(decision.contextSnapshot).toMatchObject({
      wakeReason: FINISH_SUCCESSFUL_RUN_HANDOFF_REASON,
      sourceRunId: "run-1",
    });
    expect(decision.payload).not.toHaveProperty("resumeIntent");
    expect(decision.payload).not.toHaveProperty("followUpRequested");
    expect(decision.payload).not.toHaveProperty("resumeFromRunId");
    expect(decision.contextSnapshot).not.toHaveProperty("resumeIntent");
    expect(decision.contextSnapshot).not.toHaveProperty("followUpRequested");
    expect(decision.contextSnapshot).not.toHaveProperty("resumeFromRunId");
  });
});
