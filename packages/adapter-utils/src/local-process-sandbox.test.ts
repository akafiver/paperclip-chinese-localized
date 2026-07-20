import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildLocalProcessSandboxSpawnTarget } from "./local-process-sandbox.js";

async function commandExists(command: string): Promise<boolean> {
  const pathEnv = process.env.PATH ?? "";
  for (const directory of pathEnv.split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, command);
    try {
      await fs.access(candidate);
      return true;
    } catch {
      // try next PATH entry
    }
  }
  return false;
}

async function runSpawnTarget(input: {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string | undefined>;
}): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const env = { ...process.env, ...input.env };
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete env[key];
    }
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

describe("buildLocalProcessSandboxSpawnTarget", () => {
  it("confines macOS local adapter processes away from the Paperclip source tree", async () => {
    if (process.platform !== "darwin") return;
    if (!(await commandExists("sandbox-exec"))) return;

    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-sandbox-workspace-"));
    const sourcePackageJson = path.resolve("package.json");
    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: "/bin/sh",
      args: [
        "-c",
        [
          "pwd",
          "printf workspace-ok > workspace-write.txt",
          `if cat ${JSON.stringify(sourcePackageJson)} >/dev/null 2>&1; then`,
          "  echo SOURCE_READ_ALLOWED",
          "  exit 42",
          "else",
          "  echo SOURCE_READ_DENIED",
          "fi",
        ].join("\n"),
      ],
      cwd: workspaceDir,
      options: {
        workspaceDir,
        filesystemScope: "workspace",
      },
    });

    const result = await runSpawnTarget(target);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(workspaceDir);
    expect(result.stdout).toContain("SOURCE_READ_DENIED");
    await expect(fs.readFile(path.join(workspaceDir, "workspace-write.txt"), "utf8")).resolves.toBe("workspace-ok");
  });
});
