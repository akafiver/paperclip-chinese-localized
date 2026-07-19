// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  InstanceExperimentalSettings as InstanceExperimentalSettingsPayload,
  IssueGraphLivenessAutoRecoveryPreview,
} from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstanceExperimentalSettings } from "./InstanceExperimentalSettings";

const mockInstanceSettingsApi = vi.hoisted(() => ({
  getExperimental: vi.fn(),
  updateExperimental: vi.fn(),
  previewIssueGraphLivenessAutoRecovery: vi.fn(),
  runIssueGraphLivenessAutoRecovery: vi.fn(),
}));

vi.mock("@/api/instanceSettings", () => ({
  instanceSettingsApi: mockInstanceSettingsApi,
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));

async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void> = undefined;
  flushSync(() => {
    result = callback();
  });
  await result;
}

async function flushReact() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
  flushSync(() => {});
}

const CONFERENCE_TOGGLE_SELECTOR =
  'button[aria-label="切换会议室聊天实验设置"]';
const STREAMLINED_TOGGLE_SELECTOR =
  'button[aria-label="Toggle streamlined left navigation experimental setting"]';
const TASK_WATCHDOGS_TOGGLE_SELECTOR =
  'button[aria-label="切换任务 Watchdog 实验设置"]';
const GOALS_SIDEBAR_LINK_TOGGLE_SELECTOR =
  'button[aria-label="切换目标侧栏入口实验设置"]';
const DECISIONS_TOGGLE_SELECTOR =
  'button[aria-label="切换 Decisions 实验设置"]';
const SERVER_INFO_TOGGLE_SELECTOR =
  'button[aria-label="切换服务器信息调试视图实验设置"]';
const BUILT_IN_AGENTS_TOGGLE_SELECTOR =
  'button[aria-label="切换内置 Agent 实验设置"]';
const APPS_TOGGLE_SELECTOR = 'button[aria-label="切换 Apps 实验设置"]';
const AUTO_RECOVERY_TOGGLE_SELECTOR =
  'button[aria-label="切换任务图活跃性自动恢复"]';

function defaultExperimentalSettings(): InstanceExperimentalSettingsPayload {
  return {
    enableEnvironments: false,
    enableIsolatedWorkspaces: false,
    enableStreamlinedLeftNavigation: true,
    enableApps: false,
    enablePipelines: false,
    enableCases: false,
    enableConferenceRoomChat: false,
    enableIssuePlanDecompositions: false,
    enableExperimentalFileViewer: false,
    enableExternalObjects: false,
    enableBuiltInAgents: false,
    enableDecisions: false,
    enableGoalsSidebarLink: false,
    enableTaskWatchdogs: false,
    enableCloudSync: false,
    enableServerInfoDebugView: false,
    enableSmokeLab: false,
    autoRestartDevServerWhenIdle: false,
    enableIssueGraphLivenessAutoRecovery: false,
    issueGraphLivenessAutoRecoveryLookbackHours: 24,
    enableWorkspaceBranchReconcileForward: true,
    enableWorkspaceDirtyQuarantineRepair: true,
    enableWorktreeRunExecution: false,
    worktreeRunExecutionActivatedAt: null,
    worktreeRunExecutionActivationInstanceId: null,
  };
}

function emptyRecoveryPreview(): IssueGraphLivenessAutoRecoveryPreview {
  return {
    lookbackHours: 24,
    cutoff: "2026-07-12T16:00:00.000Z",
    generatedAt: "2026-07-13T16:00:00.000Z",
    findings: 0,
    recoverableFindings: 0,
    skippedOutsideLookback: 0,
    items: [],
  };
}

const WORKTREE_RUN_EXECUTION_TOGGLE_SELECTOR =
  'button[aria-label="切换 worktree 运行执行设置"]';

function setWorktreeRuntimeMeta(enabled: boolean) {
  const name = "paperclip-worktree-enabled";
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (enabled) {
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", name);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "true");
  } else if (meta) {
    meta.remove();
  }
}

function setWorktreeInstanceIdMeta(instanceId: string | null) {
  const name = "paperclip-instance-id";
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (instanceId) {
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", name);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", instanceId);
  } else if (meta) {
    meta.remove();
  }
}

describe("InstanceExperimentalSettings — Conference Room Chat card (PAP-11233)", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let currentExperimentalSettings: InstanceExperimentalSettingsPayload;

  async function renderPage() {
    root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    flushSync(() => {
      root!.render(
        <QueryClientProvider client={queryClient}>
          <InstanceExperimentalSettings />
        </QueryClientProvider>,
      );
    });
    await flushReact();
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    currentExperimentalSettings = defaultExperimentalSettings();
    mockInstanceSettingsApi.getExperimental.mockImplementation(async () => ({
      ...currentExperimentalSettings,
    }));
    mockInstanceSettingsApi.updateExperimental.mockImplementation(async (patch) => {
      currentExperimentalSettings = { ...currentExperimentalSettings, ...patch };
      return { ...currentExperimentalSettings };
    });
  });

  afterEach(() => {
    flushSync(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
    setWorktreeRuntimeMeta(false);
    setWorktreeInstanceIdMeta(null);
    vi.clearAllMocks();
  });

  it("renders a page-level warning about instability and lack of guarantees", async () => {
    await renderPage();

    const warning = [...container.querySelectorAll('[role="alert"]')].find((alert) =>
      alert.textContent?.includes("实验功能可能随时发生破坏性变化。"),
    );
    expect(warning?.textContent).toContain("实验功能可能随时发生破坏性变化。");
    expect(warning?.textContent).toContain("不提供兼容性保证");
  });

  it("enables the Apps UI from experimental settings", async () => {
    await renderPage();

    const toggle = container.querySelector<HTMLButtonElement>(APPS_TOGGLE_SELECTOR);
    expect(toggle?.getAttribute("aria-checked")).toBe("false");

    await act(() => toggle?.click());
    await flushReact();

    expect(mockInstanceSettingsApi.updateExperimental).toHaveBeenCalledWith({ enableApps: true });
    expect(container.querySelector(APPS_TOGGLE_SELECTOR)?.getAttribute("aria-checked")).toBe("true");
  });

  it("does not render the Conference Room Chat experimental setting for now", async () => {
    await renderPage();

    const headings = [...container.querySelectorAll("section h2")].map((h) => h.textContent);
    expect(headings).not.toContain("会议室聊天");
    expect(container.querySelector(CONFERENCE_TOGGLE_SELECTOR)).toBeNull();
  });

  it("does not render the Pipelines experimental setting for now", async () => {
    await renderPage();

    const headings = [...container.querySelectorAll("section h2")].map((h) => h.textContent);
    expect(headings).not.toContain("Pipelines");
    expect(container.querySelector('button[aria-label="Toggle pipelines experimental setting"]')).toBeNull();
  });

  it("does not render the toggle even when the stored flag is currently enabled", async () => {
    currentExperimentalSettings = {
      ...currentExperimentalSettings,
      enableConferenceRoomChat: true,
    };
    await renderPage();

    const toggle = container.querySelector(CONFERENCE_TOGGLE_SELECTOR);
    expect(toggle).toBeNull();
    expect(mockInstanceSettingsApi.updateExperimental).not.toHaveBeenCalled();
  });

  it("no longer renders the Streamlined Left Navigation toggle (opt-out retired, PAP-12472)", async () => {
    await renderPage();

    const headings = [...container.querySelectorAll("section h2")].map((h) => h.textContent);
    expect(headings).not.toContain("Streamlined Left Navigation Bar");
    expect(container.querySelector(STREAMLINED_TOGGLE_SELECTOR)).toBeNull();
    expect(mockInstanceSettingsApi.updateExperimental).not.toHaveBeenCalled();
  });

  it("renders and patches the Task Watchdogs experimental toggle on and off", async () => {
    await renderPage();

    expect(container.textContent).toContain("任务 Watchdog");
    expect(container.textContent).toContain(
      "在任务详情中显示 Watchdog Agent 配置控件",
    );

    const toggle = container.querySelector<HTMLButtonElement>(TASK_WATCHDOGS_TOGGLE_SELECTOR);
    expect(toggle?.getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      toggle?.click();
    });
    await flushReact();

    expect(mockInstanceSettingsApi.updateExperimental).toHaveBeenCalledWith({
      enableTaskWatchdogs: true,
    });
    expect(toggle?.getAttribute("aria-checked")).toBe("true");

    flushSync(() => {
      root?.unmount();
    });
    root = null;
    container.textContent = "";
    await renderPage();

    const enabledToggle = container.querySelector<HTMLButtonElement>(TASK_WATCHDOGS_TOGGLE_SELECTOR);
    expect(enabledToggle?.getAttribute("aria-checked")).toBe("true");

    await act(async () => {
      enabledToggle?.click();
    });
    await flushReact();

    expect(mockInstanceSettingsApi.updateExperimental).toHaveBeenLastCalledWith({
      enableTaskWatchdogs: false,
    });
  });

  it("renders and patches the Decisions experimental toggle", async () => {
    await renderPage();

    expect(container.textContent).toContain("Decisions");
    expect(container.textContent).toContain(
      "在主侧栏显示 Decisions",
    );

    const toggle = container.querySelector<HTMLButtonElement>(DECISIONS_TOGGLE_SELECTOR);
    expect(toggle?.getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      toggle?.click();
    });
    await flushReact();

    expect(mockInstanceSettingsApi.updateExperimental).toHaveBeenCalledWith({
      enableDecisions: true,
    });
    expect(toggle?.getAttribute("aria-checked")).toBe("true");
  });

  it("renders and patches the Goals Sidebar Link experimental toggle", async () => {
    await renderPage();

    expect(container.textContent).toContain("目标侧栏入口");
    expect(container.textContent).toContain(
      "恢复主侧栏中的 Goals 项",
    );

    const toggle = container.querySelector<HTMLButtonElement>(GOALS_SIDEBAR_LINK_TOGGLE_SELECTOR);
    expect(toggle?.getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      toggle?.click();
    });
    await flushReact();

    expect(mockInstanceSettingsApi.updateExperimental).toHaveBeenCalledWith({
      enableGoalsSidebarLink: true,
    });
    expect(toggle?.getAttribute("aria-checked")).toBe("true");
  });

  it("hides the worktree run-execution toggle when not running in a worktree", async () => {
    setWorktreeRuntimeMeta(false);
    await renderPage();

    const headings = [...container.querySelectorAll("section h2")].map((h) => h.textContent);
    expect(headings).not.toContain("在此 worktree 中运行任务");
    expect(container.querySelector(WORKTREE_RUN_EXECUTION_TOGGLE_SELECTOR)).toBeNull();
  });

  it("renders and patches the worktree run-execution toggle when in a worktree", async () => {
    setWorktreeRuntimeMeta(true);
    await renderPage();

    expect(container.textContent).toContain("在此 worktree 中运行任务");
    expect(container.textContent).toContain(
      "隔离的 git-worktree 预览实例",
    );

    const toggle = container.querySelector<HTMLButtonElement>(WORKTREE_RUN_EXECUTION_TOGGLE_SELECTOR);
    expect(toggle?.getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      toggle?.click();
    });
    await flushReact();

    expect(mockInstanceSettingsApi.updateExperimental).toHaveBeenCalledWith({
      enableWorktreeRunExecution: true,
    });
    expect(toggle?.getAttribute("aria-checked")).toBe("true");
  });

  it("shows the cutoff-copy for the worktree run-execution toggle when off", async () => {
    setWorktreeRuntimeMeta(true);
    await renderPage();

    expect(container.textContent).toContain(
      "只有启用后创建的任务会自动运行",
    );
    expect(container.textContent).toContain("关闭后再打开会重置截止点。");
    // Off => no armed banner and no fail-closed hint.
    expect(container.textContent).not.toContain("正在运行创建时间晚于以下时间的任务");
    expect(container.textContent).not.toContain("执行已被抑制");
  });

  it("shows the armed timestamp when the flag matches the current instance", async () => {
    setWorktreeRuntimeMeta(true);
    setWorktreeInstanceIdMeta("inst-current");
    currentExperimentalSettings = {
      ...currentExperimentalSettings,
      enableWorktreeRunExecution: true,
      worktreeRunExecutionActivatedAt: "2026-07-10T18:34:00.000Z",
      worktreeRunExecutionActivationInstanceId: "inst-current",
    };
    await renderPage();

    expect(container.textContent).toContain("正在运行创建时间晚于以下时间的任务");
    expect(container.textContent).not.toContain("执行已被抑制");
    const toggle = container.querySelector<HTMLButtonElement>(WORKTREE_RUN_EXECUTION_TOGGLE_SELECTOR);
    expect(toggle?.getAttribute("aria-checked")).toBe("true");
  });

  it("fails closed with a re-enable hint when the flag was armed in another instance", async () => {
    setWorktreeRuntimeMeta(true);
    setWorktreeInstanceIdMeta("inst-current");
    currentExperimentalSettings = {
      ...currentExperimentalSettings,
      enableWorktreeRunExecution: true,
      worktreeRunExecutionActivatedAt: "2026-07-10T18:34:00.000Z",
      worktreeRunExecutionActivationInstanceId: "inst-other",
    };
    await renderPage();

    expect(container.textContent).toContain("执行已被抑制");
    expect(container.textContent).toContain("另一个实例中启用");
    expect(container.textContent).toContain("先关闭再重新打开");
    expect(container.textContent).not.toContain("正在运行创建时间晚于以下时间的任务");
  });

  it("fails closed with a re-enable hint when the activation cutoff is missing", async () => {
    setWorktreeRuntimeMeta(true);
    setWorktreeInstanceIdMeta("inst-current");
    currentExperimentalSettings = {
      ...currentExperimentalSettings,
      enableWorktreeRunExecution: true,
      worktreeRunExecutionActivatedAt: null,
      worktreeRunExecutionActivationInstanceId: null,
    };
    await renderPage();

    expect(container.textContent).toContain("执行已被抑制");
    expect(container.textContent).toContain("缺少启用截止点");
    expect(container.textContent).not.toContain("正在运行创建时间晚于以下时间的任务");
  });

  it("renders and patches the Built-in Agents experimental toggle", async () => {
    await renderPage();

    expect(container.textContent).toContain("内置 Agent");
    expect(container.textContent).toContain("显示 Paperclip 托管的内置 Agent 界面");

    const toggle = container.querySelector<HTMLButtonElement>(BUILT_IN_AGENTS_TOGGLE_SELECTOR);
    expect(toggle?.getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      toggle?.click();
    });
    await flushReact();

    expect(mockInstanceSettingsApi.updateExperimental).toHaveBeenCalledWith({
      enableBuiltInAgents: true,
    });
    expect(toggle?.getAttribute("aria-checked")).toBe("true");
  });

  it("renders and patches the Server Info Debug View experimental toggle", async () => {
    await renderPage();

    expect(container.textContent).toContain("服务器信息调试视图");
    expect(container.textContent).toContain(
      "在账户抽屉中显示 Server 区块",
    );

    const toggle = container.querySelector<HTMLButtonElement>(SERVER_INFO_TOGGLE_SELECTOR);
    expect(toggle?.getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      toggle?.click();
    });
    await flushReact();

    expect(mockInstanceSettingsApi.updateExperimental).toHaveBeenCalledWith({
      enableServerInfoDebugView: true,
    });
    expect(toggle?.getAttribute("aria-checked")).toBe("true");
  });

  it("removes the auto-recovery confirmation overlay after enabling only", async () => {
    mockInstanceSettingsApi.previewIssueGraphLivenessAutoRecovery.mockResolvedValue(emptyRecoveryPreview());
    await renderPage();

    const toggle = container.querySelector<HTMLButtonElement>(AUTO_RECOVERY_TOGGLE_SELECTOR);
    expect(toggle?.getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      toggle?.click();
    });
    await flushReact();

    expect(mockInstanceSettingsApi.previewIssueGraphLivenessAutoRecovery).toHaveBeenCalledWith({
      lookbackHours: 24,
    });
    expect(document.body.textContent).toContain("确认自动恢复");
    expect(document.body.querySelector('[data-slot="dialog-overlay"]')).not.toBeNull();

    const enableOnlyButton = [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "仅启用",
    );

    await act(async () => {
      enableOnlyButton?.click();
    });
    await flushReact();

    expect(mockInstanceSettingsApi.updateExperimental).toHaveBeenCalledWith({
      enableIssueGraphLivenessAutoRecovery: true,
      issueGraphLivenessAutoRecoveryLookbackHours: 24,
    });
    expect(document.body.textContent).not.toContain("确认自动恢复");
    expect(document.body.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
    const enabledToggle = container.querySelector<HTMLButtonElement>(AUTO_RECOVERY_TOGGLE_SELECTOR);
    expect(enabledToggle?.getAttribute("aria-checked")).toBe("true");
  });

  it("removes the auto-recovery confirmation overlay after enabling and running", async () => {
    mockInstanceSettingsApi.previewIssueGraphLivenessAutoRecovery.mockResolvedValue(emptyRecoveryPreview());
    mockInstanceSettingsApi.runIssueGraphLivenessAutoRecovery.mockResolvedValue({
      findings: 0,
      autoRecoveryEnabled: true,
      lookbackHours: 24,
      cutoff: "2026-07-12T16:00:00.000Z",
      escalationsCreated: 0,
      existingEscalations: 0,
      skipped: 0,
      skippedAutoRecoveryDisabled: 0,
    });
    await renderPage();

    const toggle = container.querySelector<HTMLButtonElement>(AUTO_RECOVERY_TOGGLE_SELECTOR);
    expect(toggle?.getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      toggle?.click();
    });
    await flushReact();

    expect(document.body.textContent).toContain("确认自动恢复");
    expect(document.body.querySelector('[data-slot="dialog-overlay"]')).not.toBeNull();

    const enableAndRunButton = [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "启用",
    );

    await act(async () => {
      enableAndRunButton?.click();
    });
    await flushReact();

    expect(mockInstanceSettingsApi.updateExperimental).toHaveBeenCalledWith({
      enableIssueGraphLivenessAutoRecovery: true,
      issueGraphLivenessAutoRecoveryLookbackHours: 24,
    });
    expect(mockInstanceSettingsApi.runIssueGraphLivenessAutoRecovery).toHaveBeenCalledWith({
      lookbackHours: 24,
    });
    expect(document.body.textContent).not.toContain("确认自动恢复");
    expect(document.body.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
    const enabledToggle = container.querySelector<HTMLButtonElement>(AUTO_RECOVERY_TOGGLE_SELECTOR);
    expect(enabledToggle?.getAttribute("aria-checked")).toBe("true");
  });
});
