import fs from "node:fs";
import path from "node:path";
import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
  AdapterRuntimeEvent,
  AdapterInvocationMeta,
} from "@paperclipai/adapter-utils";

type WorkerRequest = {
  type: "start";
  modulePath: string;
  context: Omit<AdapterExecutionContext, "signal" | "runtimeMcp" | "executionTarget" | "onLog" | "onMeta" | "onEvent" | "onSpawn" | "onRuntimeProgress"> & {
    executionTarget?: Record<string, unknown> | null;
    runtimeMcpServers: ReturnType<NonNullable<AdapterExecutionContext["runtimeMcp"]>["getServers"]>;
  };
};

type WorkerMessage =
  | { type: "log"; stream: "stdout" | "stderr"; chunk: string }
  | { type: "meta"; value: AdapterInvocationMeta }
  | { type: "event"; value: AdapterRuntimeEvent }
  | { type: "progress"; value: Record<string, unknown> }
  | { type: "spawn"; value: { pid: number; processGroupId: number | null; startedAt: string } }
  | { type: "result"; value: AdapterExecutionResult }
  | { type: "error"; message: string };

function workerEntryPath(): string {
  const jsPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "external-adapter-worker.js");
  if (fs.existsSync(jsPath)) return jsPath;
  return jsPath.replace(/\.js$/, ".ts");
}

function serializeExecutionTarget(target: AdapterExecutionContext["executionTarget"]): Record<string, unknown> | null {
  if (!target) return null;
  const record = target as unknown as Record<string, unknown>;
  const { runner: _runner, ...serializable } = record;
  return serializable;
}

function killProcessTree(child: ChildProcess): void {
  if (typeof child.pid !== "number" || child.pid <= 0) return;
  try {
    if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
    else child.kill("SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

export async function executeExternalAdapterInProcessBoundary(
  modulePath: string,
  ctx: AdapterExecutionContext,
  cwd: string,
): Promise<AdapterExecutionResult> {
  const child = fork(workerEntryPath(), ["--paperclip-external-adapter-worker"], {
    cwd,
    detached: process.platform !== "win32",
    execArgv: process.execArgv,
    env: {
      ...process.env,
      PAPERCLIP_EXTERNAL_ADAPTER_WORKER: "1",
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  return new Promise<AdapterExecutionResult>((resolve, reject) => {
    let settled = false;
    let abortTimer: NodeJS.Timeout | null = null;

    const finish = (error?: Error, result?: AdapterExecutionResult) => {
      if (settled) return;
      settled = true;
      if (abortTimer) clearTimeout(abortTimer);
      error ? reject(error) : resolve(result!);
    };

    child.stdout?.on("data", (chunk) => {
      void ctx.onLog("stdout", String(chunk));
    });
    child.stderr?.on("data", (chunk) => {
      void ctx.onLog("stderr", String(chunk));
    });
    child.on("message", (message: WorkerMessage) => {
      if (!message || typeof message !== "object") return;
      switch (message.type) {
        case "log":
          void ctx.onLog(message.stream, message.chunk);
          break;
        case "meta":
          void ctx.onMeta?.(message.value);
          break;
        case "event":
          void ctx.onEvent?.(message.value);
          break;
        case "progress":
          void ctx.onRuntimeProgress?.(message.value as never);
          break;
        case "spawn":
          void ctx.onSpawn?.(message.value);
          break;
        case "result":
          finish(undefined, message.value);
          break;
        case "error":
          finish(new Error(message.message));
          break;
      }
    });
    child.once("error", (error) => finish(error));
    child.once("exit", (code, signal) => {
      if (!settled) {
        finish(new Error(`External adapter process exited before returning a result (code=${code ?? "null"}, signal=${signal ?? "null"})`));
      }
    });

    const abort = () => {
      if (settled) return;
      child.send?.({ type: "abort" });
      abortTimer = setTimeout(() => {
        killProcessTree(child);
        finish(new Error("External adapter process aborted"));
      }, 15_000);
    };
    if (ctx.signal?.aborted) abort();
    else ctx.signal?.addEventListener("abort", abort, { once: true });

    const request: WorkerRequest = {
      type: "start",
      modulePath,
      context: {
        runId: ctx.runId,
        agent: ctx.agent,
        runtime: ctx.runtime,
        config: ctx.config,
        context: ctx.context,
        runtimeCommandSpec: ctx.runtimeCommandSpec ?? null,
        executionTarget: serializeExecutionTarget(ctx.executionTarget),
        executionTransport: ctx.executionTransport ?? undefined,
        authToken: ctx.authToken,
        runtimeMcpServers: ctx.runtimeMcp?.getServers() ?? [],
      },
    };
    child.send(request, (error) => {
      if (error) finish(error);
    });
  });
}
