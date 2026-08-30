import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { ProductContractSchema } from './schema.js';
import type { ProductContract } from './types.js';

export const DEFAULT_CONTRACT_FILE = '.intent/product.yaml';
export const INFERRED_CONTRACT_FILE = '.intent/product.inferred.yaml';

export async function loadContract(filePathOrDir: string): Promise<{ contract: ProductContract; filePath: string }> {
  let resolvedPath = path.resolve(filePathOrDir);

  try {
    const stat = await fs.stat(resolvedPath);
    if (stat.isDirectory()) {
      resolvedPath = path.join(resolvedPath, DEFAULT_CONTRACT_FILE);
    }
  } catch {
    // If not found directly, check if it's relative to cwd
    if (!resolvedPath.endsWith('.yaml') && !resolvedPath.endsWith('.yml')) {
      resolvedPath = path.join(resolvedPath, DEFAULT_CONTRACT_FILE);
    }
  }

  const rawContent = await fs.readFile(resolvedPath, 'utf8');
  const parsedYaml = YAML.parse(rawContent);

  const validation = ProductContractSchema.safeParse(parsedYaml);
  if (!validation.success) {
    const errorDetails = validation.error.errors
      .map(err => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Invalid Product Contract at ${resolvedPath}:\n${errorDetails}`);
  }

  return {
    contract: validation.data as ProductContract,
    filePath: resolvedPath,
  };
}

export async function saveContract(filePath: string, contract: ProductContract): Promise<void> {
  const validation = ProductContractSchema.safeParse(contract);
  if (!validation.success) {
    const errorDetails = validation.error.errors
      .map(err => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Cannot save invalid Product Contract:\n${errorDetails}`);
  }

  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const yamlContent = YAML.stringify(validation.data, {
    indent: 2,
    lineWidth: 100,
  });

  await fs.writeFile(filePath, yamlContent, 'utf8');
}

export function validateContract(raw: unknown): { success: boolean; data?: ProductContract; errors?: string[] } {
  const result = ProductContractSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data as ProductContract };
  }
  return {
    success: false,
    errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
  };
}
