import { describe, expect, it } from "vitest";

import {
  decideSuccessfulRunHandoff,
} from "./successful-run-handoff.js";

describe("decideSuccessfulRunHandoff", () => {
  it("requires an explicit outcome decision instead of queuing a corrective agent run", () => {
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
      hasActiveExecutionPath: false,
      hasQueuedWake: false,
      hasPendingInteractionOrApproval: false,
      hasPersistedMonitor: false,
      hasExplicitBlockerPath: false,
      hasOpenRecoveryIssue: false,
      hasPauseHold: false,
      hasActiveRoutineContinuation: false,
      budgetBlocked: false,
    });

    expect(decision).toEqual({
      kind: "require_user_disposition",
      missingDisposition: "clear_next_step",
    });
  });

  it("does not request a disposition when another live execution path already owns the issue", () => {
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
      hasActiveExecutionPath: true,
      hasQueuedWake: false,
      hasPendingInteractionOrApproval: false,
      hasPersistedMonitor: false,
      hasExplicitBlockerPath: false,
      hasOpenRecoveryIssue: false,
      hasPauseHold: false,
      hasActiveRoutineContinuation: false,
      budgetBlocked: false,
    });

    expect(decision).toEqual({
      kind: "skip",
      reason: "issue already has an active execution path",
    });
  });

  it("treats terminal issue status as a valid disposition", () => {
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
        status: "done",
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
      hasActiveExecutionPath: false,
      hasQueuedWake: false,
      hasPendingInteractionOrApproval: false,
      hasPersistedMonitor: false,
      hasExplicitBlockerPath: false,
      hasOpenRecoveryIssue: false,
      hasPauseHold: false,
      hasActiveRoutineContinuation: false,
      budgetBlocked: false,
    });

    expect(decision).toEqual({
      kind: "skip",
      reason: "issue status done is a valid disposition",
    });
  });
});
