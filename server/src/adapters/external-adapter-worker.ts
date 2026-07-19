import { pathToFileURL } from "node:url";
import type { AdapterExecutionContext, AdapterRuntimeEvent, AdapterInvocationMeta } from "@paperclipai/adapter-utils";

type WorkerRequest = {
  type: "start";
  modulePath: string;
  context: Omit<AdapterExecutionContext, "signal" | "runtimeMcp" | "executionTarget" | "onLog" | "onMeta" | "onEvent" | "onSpawn" | "onRuntimeProgress"> & {
    executionTarget?: Record<string, unknown> | null;
    runtimeMcpServers: Array<{ name: string; url: string; token: string; connectionId: string }>;
  };
};

let controller: AbortController | null = null;

function send(message: unknown): void {
  if (process.send) process.send(message);
}

function sendTerminal(message: unknown): void {
  if (!process.send) {
    process.exitCode = 1;
    return;
  }
  process.send(message, () => {
    process.disconnect?.();
  });
}

process.on("message", async (message: WorkerRequest | { type: "abort" }) => {
  if (message.type === "abort") {
    controller?.abort();
    return;
  }
  if (message.type !== "start") return;

  controller = new AbortController();
  try {
    const imported = await import(pathToFileURL(message.modulePath).href);
    if (typeof imported.createServerAdapter !== "function") {
      throw new Error(`External adapter module does not export createServerAdapter(): ${message.modulePath}`);
    }
    const adapter = imported.createServerAdapter();
    const base = message.context;
    const context: AdapterExecutionContext = {
      ...base,
      signal: controller.signal,
      executionTarget: base.executionTarget as AdapterExecutionContext["executionTarget"],
      runtimeMcp: {
        getServers: () => message.context.runtimeMcpServers,
      },
      onLog: async (stream, chunk) => send({ type: "log", stream, chunk }),
      onMeta: async (value: AdapterInvocationMeta) => send({ type: "meta", value }),
      onEvent: async (value: AdapterRuntimeEvent) => send({ type: "event", value }),
      onRuntimeProgress: async (value) => send({ type: "progress", value }),
      onSpawn: async (value) => send({ type: "spawn", value }),
    };
    const result = await adapter.execute(context);
    sendTerminal({ type: "result", value: result });
  } catch (error) {
    sendTerminal({ type: "error", message: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  }
});
