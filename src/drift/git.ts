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
    // 1. If baseCommit is given, diff against baseCommit
    if (baseCommit && currentCommit && baseCommit !== currentCommit) {
      const diffOutput = await git.diff(['--name-only', baseCommit]);
      diffOutput
        .split('\n')
        .map(f => f.trim())
        .filter(Boolean)
        .forEach(f => changedSet.add(f.replace(/\\/g, '/')));
    }

    // 2. Diff against HEAD (staged and unstaged working tree changes)
    const status = await git.status();
    for (const file of status.files) {
      changedSet.add(file.path.replace(/\\/g, '/'));
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
