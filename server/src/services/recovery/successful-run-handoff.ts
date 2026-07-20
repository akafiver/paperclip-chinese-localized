import { agents, heartbeatRuns, issues } from "@paperclipai/db";
import type { IssueCommentMetadata, IssueCommentPresentation, RunLivenessState } from "@paperclipai/shared";

export const FINISH_SUCCESSFUL_RUN_HANDOFF_REASON = "finish_successful_run_handoff";
export const SUCCESSFUL_RUN_MISSING_STATE_REASON = "successful_run_missing_state";
export const DEFAULT_MAX_SUCCESSFUL_RUN_HANDOFF_ATTEMPTS = 1;
export const SUCCESSFUL_RUN_HANDOFF_REQUIRED_NOTICE_BODY =
  "Paperclip 已暂停自动继续：任务可能已经完成，但还没有最终处置。请选择完成、继续、重试、阻塞或取消，避免重复执行外部动作。 / Paperclip paused automation because this task may be complete but still has no final outcome. Choose done, continue, retry, blocked, or cancelled before it can continue.";
export const SUCCESSFUL_RUN_HANDOFF_EXHAUSTED_NOTICE_BODY =
  "Paperclip 已停止自动继续：任务仍缺少最终处置。请由恢复负责人选择完成、继续、重试、阻塞或取消。 / Paperclip stopped automation because this task still has no final outcome. A recovery owner must choose the next step.";
export const LEGACY_SUCCESSFUL_RUN_HANDOFF_NOTICE_PREFIXES = [
  "## This issue still needs a next step",
  "## Successful run missing issue disposition",
] as const;

const PRODUCTIVE_SUCCESS_LIVENESS_STATES = new Set<RunLivenessState>([
  "advanced",
  "completed",
  "blocked",
  "needs_followup",
]);

type HeartbeatRunRow = typeof heartbeatRuns.$inferSelect;
type IssueRow = Pick<
  typeof issues.$inferSelect,
  "id" | "companyId" | "identifier" | "title" | "status" | "assigneeAgentId" | "assigneeUserId" | "executionState"
>;
type AgentRow = Pick<typeof agents.$inferSelect, "id" | "companyId" | "status">;
type NoticeIssue = Pick<typeof issues.$inferSelect, "id" | "identifier" | "title" | "status">;
type NoticeRun = Pick<typeof heartbeatRuns.$inferSelect, "id" | "status">;
type NoticeAgent = Pick<typeof agents.$inferSelect, "id" | "name">;
type NullableNoticeAgent = NoticeAgent | null | undefined;
type NullableNoticeIssue = NoticeIssue | null | undefined;
type NullableNoticeRun = NoticeRun | null | undefined;

export type SuccessfulRunHandoffNotice = {
  body: string;
  presentation: IssueCommentPresentation;
  metadata: IssueCommentMetadata;
};

export function noticeMetadataReferencesRecoveryAction(
  metadata: IssueCommentMetadata | null | undefined,
  recoveryActionId: string,
) {
  return (metadata?.sections ?? []).some((section) =>
    section.rows.some((row) =>
      row.type === "key_value" &&
      row.label === "Recovery action" &&
      row.value === recoveryActionId,
    ),
  );
}

export type SuccessfulRunHandoffDecision =
  | {
      kind: "require_user_disposition";
      missingDisposition: "clear_next_step";
    }
  | {
      kind: "skip";
      reason: string;
    };

const SUCCESSFUL_RUN_HANDOFF_VALID_PATH_SKIP_REASONS = new Set([
  "issue has execution policy state",
  "active routine continuation owns the next action",
  "issue already has an active execution path",
  "issue already has a queued or deferred wake",
  "pending interaction or approval owns the next action",
  "persisted issue monitor owns the next action",
  "explicit blocker path owns the next action",
  "open recovery issue owns the ambiguity",
  "issue is under an active pause hold",
]);

export function isSuccessfulRunHandoffValidPathSkip(
  decision: SuccessfulRunHandoffDecision,
): decision is Extract<SuccessfulRunHandoffDecision, { kind: "skip" }> {
  return decision.kind === "skip" && SUCCESSFUL_RUN_HANDOFF_VALID_PATH_SKIP_REASONS.has(decision.reason);
}

function metadataText(value: unknown, fallback = "unknown") {
  const text = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  const resolved = text.length > 0 ? text : fallback;
  return resolved.length > 2000 ? `${resolved.slice(0, 1997)}...` : resolved;
}

function keyValueRow(label: string, value: unknown): IssueCommentMetadata["sections"][number]["rows"][number] {
  return { type: "key_value", label, value: metadataText(value) };
}

function issueLinkRow(
  label: string,
  issue: NullableNoticeIssue,
): IssueCommentMetadata["sections"][number]["rows"][number] {
  if (!issue) return keyValueRow(label, "unknown");
  return {
    type: "issue_link",
    label,
    issueId: issue.id,
    identifier: issue.identifier,
    title: issue.title,
  };
}

function runLinkRow(
  label: string,
  run: NullableNoticeRun,
): IssueCommentMetadata["sections"][number]["rows"][number] {
  if (!run) return keyValueRow(label, "unknown");
  return { type: "run_link", label, runId: run.id, title: run.status };
}

function agentLinkRow(
  label: string,
  agent: NullableNoticeAgent,
): IssueCommentMetadata["sections"][number]["rows"][number] {
  if (!agent) return keyValueRow(label, "unknown");
  return { type: "agent_link", label, agentId: agent.id, name: agent.name };
}

function systemNoticePresentation(input: {
  tone: IssueCommentPresentation["tone"];
  title: string;
}): IssueCommentPresentation {
  return {
    kind: "system_notice",
    tone: input.tone,
    title: input.title,
    detailsDefaultOpen: false,
  };
}

export function isSuccessfulRunHandoffRequiredNoticeBody(body: string) {
  const trimmed = body.trim();
  return trimmed === SUCCESSFUL_RUN_HANDOFF_REQUIRED_NOTICE_BODY ||
    (trimmed.startsWith("Paperclip needs a disposition") && trimmed.endsWith("before this issue can continue.")) ||
    LEGACY_SUCCESSFUL_RUN_HANDOFF_NOTICE_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export function buildSuccessfulRunHandoffRequiredNotice(input: {
  issue: NoticeIssue;
  run: NoticeRun;
  agent: NoticeAgent;
  detectedProgressSummary: string;
}): SuccessfulRunHandoffNotice {
  return {
    body: SUCCESSFUL_RUN_HANDOFF_REQUIRED_NOTICE_BODY,
    presentation: systemNoticePresentation({
      tone: "warning",
      title: "需要确认任务结果 / Outcome decision needed",
    }),
    metadata: {
      version: 1,
      sourceRunId: input.run.id,
      sections: [
        {
          title: "需要你选择下一步",
          rows: [
            issueLinkRow("任务", input.issue),
            agentLinkRow("负责人", input.agent),
            keyValueRow("为什么暂停", "Agent 运行成功，但没有把任务明确标记为完成、继续、阻塞、审核或取消。"),
            keyValueRow("安全策略", "为避免重复发送邮件、重复调用 API 或重复执行外部动作，Paperclip 不会自动再运行 Agent。"),
            keyValueRow(
              "可选处理",
              "标记完成、继续执行、重试、标记阻塞、取消，或交给明确负责人审核。",
            ),
          ],
        },
        {
          title: "运行证据",
          rows: [
            runLinkRow("成功运行", input.run),
            keyValueRow("运行状态", input.run.status),
            keyValueRow("标准原因", SUCCESSFUL_RUN_MISSING_STATE_REASON),
            keyValueRow("检测到的进展", input.detectedProgressSummary),
            keyValueRow("自动重试", "已禁用；等待用户或恢复负责人选择任务结果。"),
          ],
        },
      ],
    },
  };
}

export function buildSuccessfulRunHandoffExhaustedNotice(input: {
  issue: NoticeIssue;
  sourceRun: NullableNoticeRun;
  correctiveRun: NullableNoticeRun;
  sourceAssignee: NullableNoticeAgent;
  recoveryIssue: NullableNoticeIssue;
  recoveryActionId?: string | null;
  recoveryOwner: NullableNoticeAgent;
  latestIssueStatus: string;
  latestHandoffRunStatus: string;
  missingDisposition: string;
}): SuccessfulRunHandoffNotice {
  return {
    body: SUCCESSFUL_RUN_HANDOFF_EXHAUSTED_NOTICE_BODY,
    presentation: systemNoticePresentation({
      tone: "warning",
      title: "Outcome decision still needed",
    }),
    metadata: {
      version: 1,
      sourceRunId: input.sourceRun?.id ?? null,
      sections: [
        {
          title: "Recovery owner",
          rows: [
            issueLinkRow("Source issue", input.issue),
            input.recoveryActionId
              ? keyValueRow("Recovery action", input.recoveryActionId)
              : issueLinkRow("Recovery issue", input.recoveryIssue),
            agentLinkRow("Recovery owner", input.recoveryOwner),
            agentLinkRow("Source assignee", input.sourceAssignee),
            keyValueRow("Suggested action", "choose and record a valid issue disposition without copying transcript content"),
          ],
        },
        {
          title: "Run evidence",
          rows: [
            runLinkRow("Source run", input.sourceRun),
            runLinkRow("后续运行（如有）", input.correctiveRun),
            keyValueRow("最新任务状态", input.latestIssueStatus),
            keyValueRow("最新运行状态", input.latestHandoffRunStatus),
            keyValueRow("标准原因", SUCCESSFUL_RUN_MISSING_STATE_REASON),
            keyValueRow("缺少的处置", input.missingDisposition),
          ],
        },
      ],
    },
  };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isCorrectiveHandoffRun(run: HeartbeatRunRow) {
  const context = readRecord(run.contextSnapshot);
  return context.handoffRequired === true ||
    readString(context.wakeReason) === FINISH_SUCCESSFUL_RUN_HANDOFF_REASON;
}

function isIssueMonitorMaintenanceRun(run: HeartbeatRunRow) {
  const context = readRecord(run.contextSnapshot);
  const wakeReason = readString(context.wakeReason);
  const source = readString(context.source);
  return Boolean(wakeReason?.startsWith("issue_monitor") || source?.startsWith("issue.monitor"));
}

function isCommentDrivenWake(run: HeartbeatRunRow) {
  const context = readRecord(run.contextSnapshot);
  const wakeReason = readString(context.wakeReason);
  return wakeReason === "issue_commented" ||
    wakeReason === "issue_comment_mentioned" ||
    wakeReason === "issue_reopened_via_comment";
}

function isProductiveSuccessfulRun(input: {
  livenessState: RunLivenessState | null;
  detectedProgressSummary: string | null;
}) {
  if (input.livenessState && PRODUCTIVE_SUCCESS_LIVENESS_STATES.has(input.livenessState)) return true;
  return Boolean(input.detectedProgressSummary);
}

export function decideSuccessfulRunHandoff(input: {
  run: HeartbeatRunRow;
  issue: IssueRow | null;
  agent: AgentRow | null;
  livenessState: RunLivenessState | null;
  detectedProgressSummary: string | null;
  hasActiveExecutionPath: boolean;
  hasQueuedWake: boolean;
  hasPendingInteractionOrApproval: boolean;
  hasPersistedMonitor: boolean;
  hasExplicitBlockerPath: boolean;
  hasOpenRecoveryIssue: boolean;
  hasPauseHold: boolean;
  hasActiveRoutineContinuation: boolean;
  budgetBlocked: boolean;
}): SuccessfulRunHandoffDecision {
  const { run, issue, agent } = input;

  if (run.status !== "succeeded") return { kind: "skip", reason: "source run did not succeed" };
  if (isCorrectiveHandoffRun(run)) return { kind: "skip", reason: "source run is already a corrective handoff run" };
  if (isIssueMonitorMaintenanceRun(run)) return { kind: "skip", reason: "issue monitor run owns its own recovery path" };
  if (isCommentDrivenWake(run)) return { kind: "skip", reason: "comment-driven wake already owns the next action" };
  if (run.issueCommentStatus === "retry_queued" || run.issueCommentStatus === "retry_exhausted") {
    return { kind: "skip", reason: "missing issue comment retry owns the next action" };
  }
  if (!issue) return { kind: "skip", reason: "issue not found" };
  if (!agent) return { kind: "skip", reason: "agent not found" };
  if (issue.companyId !== run.companyId || agent.companyId !== run.companyId) {
    return { kind: "skip", reason: "company scope mismatch" };
  }
  if (issue.assigneeAgentId !== run.agentId) {
    return { kind: "skip", reason: "issue is no longer assigned to the source run agent" };
  }
  if (issue.assigneeUserId) return { kind: "skip", reason: "issue is human-owned" };
  if (issue.status !== "in_progress") return { kind: "skip", reason: `issue status ${issue.status} is a valid disposition` };
  if (issue.executionState) return { kind: "skip", reason: "issue has execution policy state" };
  if (agent.status === "paused" || agent.status === "terminated" || agent.status === "pending_approval") {
    return { kind: "skip", reason: `agent status ${agent.status} is not invokable` };
  }
  if (input.hasActiveRoutineContinuation) {
    return { kind: "skip", reason: "active routine continuation owns the next action" };
  }
  if (!isProductiveSuccessfulRun(input)) {
    return { kind: "skip", reason: "successful run did not produce handoff-relevant progress" };
  }
  if (input.hasActiveExecutionPath) return { kind: "skip", reason: "issue already has an active execution path" };
  if (input.hasQueuedWake) return { kind: "skip", reason: "issue already has a queued or deferred wake" };
  if (input.hasPendingInteractionOrApproval) {
    return { kind: "skip", reason: "pending interaction or approval owns the next action" };
  }
  if (input.hasPersistedMonitor) return { kind: "skip", reason: "persisted issue monitor owns the next action" };
  if (input.hasExplicitBlockerPath) return { kind: "skip", reason: "explicit blocker path owns the next action" };
  if (input.hasOpenRecoveryIssue) return { kind: "skip", reason: "open recovery issue owns the ambiguity" };
  if (input.hasPauseHold) return { kind: "skip", reason: "issue is under an active pause hold" };
  if (input.budgetBlocked) return { kind: "skip", reason: "budget hard stop blocks corrective wake" };

  return {
    kind: "require_user_disposition",
    missingDisposition: "clear_next_step",
  };
}
