import path from 'node:path';
import { simpleGit, SimpleGit } from 'simple-git';

export interface GitChangeSummary {
  isGitRepo: boolean;
  currentCommit?: string;
  changedFiles: string[];
}

export async function getGitChanges(
  workspaceRoot: string,
  baseCommit?: string
): Promise<GitChangeSummary> {
  const git: SimpleGit = simpleGit(workspaceRoot);

  const isRepo = await git.checkIsRepo().catch(() => false);
  if (!isRepo) {
    return {
      isGitRepo: false,
      changedFiles: [],
    };
  }

  let currentCommit: string | undefined;
  try {
    const log = await git.log({ maxCount: 1 });
    currentCommit = log.latest?.hash;
  } catch {
    // Might be an empty git repo with no commits
  }

  const changedSet = new Set<string>();

  try {
    const topLevel = (await git.revparse(['--show-toplevel'])).trim();

    const addFile = (file: string) => {
      const absPath = path.resolve(topLevel, file.trim());
      const relPath = path.relative(workspaceRoot, absPath).replace(/\\/g, '/');
      if (!relPath.startsWith('..') && !path.isAbsolute(relPath)) {
        changedSet.add(relPath);
      } else {
        changedSet.add(file.trim().replace(/\\/g, '/'));
      }
    };

    // 1. If baseCommit is given, diff against baseCommit
    if (baseCommit && currentCommit && baseCommit !== currentCommit) {
      const diffOutput = await git.diff(['--name-only', baseCommit]);
      diffOutput
        .split('\n')
        .map(f => f.trim())
        .filter(Boolean)
        .forEach(addFile);
    }

    // 2. Diff against HEAD (staged and unstaged working tree changes)
    const status = await git.status();
    for (const file of status.files) {
      addFile(file.path);
    }
  } catch {
    // Fallback if diff fails
  }

  // Filter out self-generated runtime metadata (.intent/evidence/, .intent/drift/)
  const filteredChangedFiles = Array.from(changedSet).filter(file => {
    const normalized = file.replace(/\\/g, '/');
    return !normalized.startsWith('.intent/evidence/') && !normalized.startsWith('.intent/drift/');
  });

  return {
    isGitRepo: true,
    currentCommit,
    changedFiles: filteredChangedFiles,
  };
}
