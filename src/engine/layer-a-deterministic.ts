import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { FileProbe, HttpProbe, ExecProbe, ProbeResult } from '../contract/types.js';

const execAsync = promisify(exec);

export async function runFileProbe(probe: FileProbe, workspaceRoot: string): Promise<ProbeResult> {
  const startTime = Date.now();
  const targetPath = path.isAbsolute(probe.path) ? probe.path : path.join(workspaceRoot, probe.path);

  try {
    const stat = await fs.stat(targetPath);

    if (probe.mustExist === false && stat) {
      return {
        probe,
        status: 'FAIL',
        durationMs: Date.now() - startTime,
        message: `File probe failed: ${probe.path} exists but mustExist is false`,
      };
    }

    if (probe.pattern || probe.notPattern) {
      if (stat.isDirectory()) {
        // Search across files in directory if pattern specified
        const found = await searchDirectory(targetPath, probe.pattern, probe.notPattern);
        const durationMs = Date.now() - startTime;
        if (!found.success) {
          return {
            probe,
            status: 'FAIL',
            durationMs,
            message: `File probe failed in directory ${probe.path}: ${found.message}`,
          };
        }
        return {
          probe,
          status: 'PASS',
          durationMs,
          message: `File pattern verified in directory ${probe.path}`,
        };
      }

      const content = await fs.readFile(targetPath, 'utf8');
      const patternResult = testContentPatterns(content, probe.path, probe.pattern, probe.notPattern);
      if (!patternResult.success) {
        return {
          probe,
          status: 'FAIL',
          durationMs: Date.now() - startTime,
          message: patternResult.message!,
        };
      }
    }

    return {
      probe,
      status: 'PASS',
      durationMs: Date.now() - startTime,
      message: `File probe verified: ${probe.path}`,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    if (err.code === 'ENOENT') {
      if (probe.mustExist === false) {
        return {
          probe,
          status: 'PASS',
          durationMs,
          message: `File correctly does not exist: ${probe.path}`,
        };
      }
      return {
        probe,
        status: 'FAIL',
        durationMs,
        message: `Required file not found: ${probe.path}`,
      };
    }

    return {
      probe,
      status: 'UNKNOWN',
      durationMs,
      error: `File probe infrastructure error: ${err.message}`,
    };
  }
}

async function searchDirectory(dir: string, pattern?: string, notPattern?: string): Promise<{ success: boolean; message?: string }> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.intent') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const res = await searchDirectory(fullPath, pattern, notPattern);
      if (!res.success) return res;
    } else if (entry.isFile()) {
      const content = await fs.readFile(fullPath, 'utf8');
      if (notPattern && new RegExp(notPattern).test(content)) {
        return { success: false, message: `Forbidden pattern /${notPattern}/ found in ${fullPath}` };
      }
      if (pattern && new RegExp(pattern).test(content)) {
        return { success: true };
      }
    }
  }
  if (pattern) {
    return { success: false, message: `Pattern /${pattern}/ not found in any file under directory` };
  }
  return { success: true };
}

function testContentPatterns(
  content: string,
  filePath: string,
  pattern?: string,
  notPattern?: string
): { success: boolean; message?: string } {
  if (pattern) {
    const regex = new RegExp(pattern);
    if (!regex.test(content)) {
      return {
        success: false,
        message: `File ${filePath} does not match required pattern: /${pattern}/`,
      };
    }
  }

  if (notPattern) {
    const notRegex = new RegExp(notPattern);
    if (notRegex.test(content)) {
      return {
        success: false,
        message: `File ${filePath} contains forbidden pattern: /${notPattern}/`,
      };
    }
  }

  return { success: true };
}

export async function runHttpProbe(probe: HttpProbe): Promise<ProbeResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutMs = probe.timeoutMs || 5000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(probe.url, {
      method: probe.method || 'GET',
      headers: probe.headers,
      body: probe.body ? (typeof probe.body === 'string' ? probe.body : JSON.stringify(probe.body)) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const expectedStatus = probe.expectStatus ?? 200;
    if (response.status !== expectedStatus) {
      return {
        probe,
        status: 'FAIL',
        durationMs: Date.now() - startTime,
        message: `HTTP probe status mismatch: expected ${expectedStatus}, got ${response.status} (${response.statusText})`,
        details: { status: response.status, url: probe.url },
      };
    }

    if (probe.expectJsonMatch) {
      let bodyData: any;
      try {
        bodyData = await response.json();
      } catch (err) {
        return {
          probe,
          status: 'FAIL',
          durationMs: Date.now() - startTime,
          message: `Expected JSON response but could not parse response body`,
        };
      }

      for (const [key, expectedVal] of Object.entries(probe.expectJsonMatch)) {
        if (bodyData[key] !== expectedVal) {
          return {
            probe,
            status: 'FAIL',
            durationMs: Date.now() - startTime,
            message: `JSON match failure for key "${key}": expected ${JSON.stringify(expectedVal)}, got ${JSON.stringify(bodyData[key])}`,
            details: { expected: probe.expectJsonMatch, received: bodyData },
          };
        }
      }
    }

    return {
      probe,
      status: 'PASS',
      durationMs: Date.now() - startTime,
      message: `HTTP probe passed (${response.status} OK)`,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;

    // Infrastructure / unreachable errors -> UNKNOWN (server not running or network unreachable)
    if (err.name === 'AbortError' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.cause?.code === 'ECONNREFUSED') {
      return {
        probe,
        status: 'UNKNOWN',
        durationMs,
        message: `Target endpoint unreachable: ${probe.url} (${err.message})`,
        error: err.message,
      };
    }

    return {
      probe,
      status: 'FAIL',
      durationMs,
      message: `HTTP request failed: ${err.message}`,
      error: err.message,
    };
  }
}

export async function runExecProbe(probe: ExecProbe, workspaceRoot: string): Promise<ProbeResult> {
  const startTime = Date.now();
  const cwd = probe.cwd ? (path.isAbsolute(probe.cwd) ? probe.cwd : path.join(workspaceRoot, probe.cwd)) : workspaceRoot;
  const timeoutMs = probe.timeoutMs || 10000;

  try {
    const { stdout, stderr } = await execAsync(probe.command, {
      cwd,
      timeout: timeoutMs,
    });

    const durationMs = Date.now() - startTime;
    const output = `${stdout}\n${stderr}`;

    if (probe.expectOutputPattern) {
      const regex = new RegExp(probe.expectOutputPattern);
      if (!regex.test(output)) {
        return {
          probe,
          status: 'FAIL',
          durationMs,
          message: `Command output does not match expected pattern: /${probe.expectOutputPattern}/`,
          details: { stdout, stderr },
        };
      }
    }

    return {
      probe,
      status: 'PASS',
      durationMs,
      message: `Command executed successfully (exit code 0)`,
      details: { stdout: stdout.trim() },
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const expectedExitCode = probe.expectExitCode ?? 0;

    if (typeof err.code === 'number') {
      if (err.code === expectedExitCode) {
        return {
          probe,
          status: 'PASS',
          durationMs,
          message: `Command exited with expected exit code ${expectedExitCode}`,
        };
      }
      return {
        probe,
        status: 'FAIL',
        durationMs,
        message: `Command failed with exit code ${err.code} (expected ${expectedExitCode})`,
        details: { stdout: err.stdout, stderr: err.stderr },
      };
    }

    // Infrastructure execution error (e.g. binary not found)
    return {
      probe,
      status: 'UNKNOWN',
      durationMs,
      error: `Command execution error: ${err.message}`,
    };
  }
}
