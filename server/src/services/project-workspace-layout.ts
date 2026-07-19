import fs from "node:fs/promises";
import path from "node:path";

export const PROJECT_WORKSPACE_LAYOUT_VERSION = 1;

export const PROJECT_WORKSPACE_DIRECTORIES = [
  "projects",
  "media",
  "documents",
  "datasets",
  "scripts",
  "outputs",
] as const;

export type ProjectWorkspaceLayout = {
  version: typeof PROJECT_WORKSPACE_LAYOUT_VERSION;
  directories: readonly string[];
  managedBy: "paperclip";
};

export function isGitBackedProjectWorkspaceSource(sourceType: string | null | undefined): boolean {
  return sourceType === "git_repo" || sourceType === "git_worktree";
}

/**
 * Establishes the system-owned organization of a non-Git project workspace.
 * Git workspaces are left untouched because their repository defines its own
 * source layout and Paperclip must not add untracked files to it.
 */
export async function ensureProjectWorkspaceLayout(input: {
  cwd: string;
  sourceType: string | null | undefined;
}): Promise<ProjectWorkspaceLayout | null> {
  if (isGitBackedProjectWorkspaceSource(input.sourceType)) return null;

  const cwd = path.resolve(input.cwd);
  await fs.mkdir(cwd, { recursive: true });
  // A local path may still point at a Git checkout even when its source type
  // was imported as local_path. Do not add organization files to that repo.
  if (await fs.lstat(path.join(cwd, ".git")).then(() => true).catch(() => false)) return null;
  await Promise.all(
    PROJECT_WORKSPACE_DIRECTORIES.map((directory) =>
      fs.mkdir(path.join(cwd, directory), { recursive: true }),
    ),
  );

  const layout: ProjectWorkspaceLayout = {
    version: PROJECT_WORKSPACE_LAYOUT_VERSION,
    directories: PROJECT_WORKSPACE_DIRECTORIES,
    managedBy: "paperclip",
  };
  const manifestPath = path.join(cwd, ".paperclip-workspace.json");
  try {
    await fs.access(manifestPath);
  } catch {
    await fs.writeFile(manifestPath, `${JSON.stringify(layout, null, 2)}\n`, { mode: 0o600 });
  }
  return layout;
}
