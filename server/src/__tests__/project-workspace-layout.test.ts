import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureProjectWorkspaceLayout,
  PROJECT_WORKSPACE_DIRECTORIES,
} from "../services/project-workspace-layout.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("project workspace layout", () => {
  it("creates the standard non-Git workspace organization", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-project-workspace-"));
    roots.push(cwd);

    const layout = await ensureProjectWorkspaceLayout({ cwd, sourceType: "local_path" });

    expect(layout?.directories).toEqual(PROJECT_WORKSPACE_DIRECTORIES);
    await expect(fs.readFile(path.join(cwd, ".paperclip-workspace.json"), "utf8")).resolves.toContain('"managedBy": "paperclip"');
    await Promise.all(PROJECT_WORKSPACE_DIRECTORIES.map(async (directory) => {
      await expect(fs.stat(path.join(cwd, directory))).resolves.toMatchObject({ isDirectory: expect.any(Function) });
    }));
  });

  it("does not add Paperclip folders to Git workspaces", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-git-project-workspace-"));
    roots.push(cwd);

    await expect(ensureProjectWorkspaceLayout({ cwd, sourceType: "git_repo" })).resolves.toBeNull();
    await expect(fs.readdir(cwd)).resolves.toEqual([]);
  });
});
