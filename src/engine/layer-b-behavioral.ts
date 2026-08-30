import path from 'node:path';
import fs from 'node:fs/promises';
import type { BehavioralProbe, ProbeResult } from '../contract/types.js';

export async function runBehavioralProbe(
  probe: BehavioralProbe,
  options: { workspaceRoot: string; evidenceDir?: string; requirementId?: string }
): Promise<ProbeResult> {
  const startTime = Date.now();
  const timeoutMs = probe.timeoutMs || 15000;

  let playwright: any;
  try {
    playwright = await import('playwright');
  } catch (err: any) {
    return {
      probe,
      status: 'UNKNOWN',
      durationMs: Date.now() - startTime,
      message: 'Playwright is not available in current environment',
      error: err.message,
    };
  }

  let browser: any = null;
  let context: any = null;
  let page: any = null;

  try {
    browser = await playwright.chromium.launch({
      headless: true,
      timeout: timeoutMs,
    });
    context = await browser.newContext();
    page = await context.newPage();

    // Create an execution sandbox with standard helper assertions
    const expectHelper = (actual: any) => ({
      toBe: (expected: any) => {
        if (actual !== expected) throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
      },
      toEqual: (expected: any) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
        }
      },
      toContain: (expected: any) => {
        if (!String(actual).includes(String(expected))) {
          throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`);
        }
      },
      toBeTruthy: () => {
        if (!actual) throw new Error(`Expected truthy, got ${actual}`);
      },
      toBeFalsy: () => {
        if (actual) throw new Error(`Expected falsy, got ${actual}`);
      },
      toHaveURL: async (pattern: RegExp | string) => {
        const currentUrl = page.url();
        if (typeof pattern === 'string') {
          if (currentUrl !== pattern) throw new Error(`Expected URL "${pattern}", got "${currentUrl}"`);
        } else if (!pattern.test(currentUrl)) {
          throw new Error(`Expected URL matching ${pattern}, got "${currentUrl}"`);
        }
      },
      toHaveTitle: async (pattern: RegExp | string) => {
        const title = await page.title();
        if (typeof pattern === 'string') {
          if (title !== pattern) throw new Error(`Expected title "${pattern}", got "${title}"`);
        } else if (!pattern.test(title)) {
          throw new Error(`Expected title matching ${pattern}, got "${title}"`);
        }
      },
    });

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction('page', 'browser', 'context', 'expect', probe.script);

    // Run script with timeout
    const executionPromise = fn(page, browser, context, expectHelper);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Behavioral probe timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    await Promise.race([executionPromise, timeoutPromise]);

    return {
      probe,
      status: 'PASS',
      durationMs: Date.now() - startTime,
      message: 'Behavioral probe script executed and assertions passed',
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    let screenshotPath: string | undefined;

    if (page && options.evidenceDir && options.requirementId) {
      try {
        const reqEvidenceDir = path.join(options.evidenceDir, options.requirementId);
        await fs.mkdir(reqEvidenceDir, { recursive: true });
        screenshotPath = path.join(reqEvidenceDir, 'failure-screenshot.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch {
        // Screenshot capture error ignored
      }
    }

    // Determine if it's an infrastructure failure (browser crash / connection refused) vs assertion failure
    const isConnRefused = err.message?.includes('net::ERR_CONNECTION_REFUSED') ||
      err.message?.includes('ECONNREFUSED') ||
      err.message?.includes('Target page, context or browser has been closed') ||
      err.message?.includes('Executable doesn\'t exist');

    if (isConnRefused) {
      return {
        probe,
        status: 'UNKNOWN',
        durationMs,
        message: `Behavioral probe runtime unreachable: ${err.message}`,
        error: err.message,
      };
    }

    return {
      probe,
      status: 'FAIL',
      durationMs,
      message: `Behavioral probe failed: ${err.message}`,
      error: err.stack || err.message,
      screenshotPath,
    };
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
