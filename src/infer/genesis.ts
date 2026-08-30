import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProductContract, Requirement, Probe } from '../contract/types.js';
import { saveContract, DEFAULT_CONTRACT_FILE, INFERRED_CONTRACT_FILE } from '../contract/parser.js';

export interface InferOptions {
  workspaceRoot: string;
  apply?: boolean;
  outputPath?: string;
}

export async function inferProductContract(options: InferOptions): Promise<{
  contract: ProductContract;
  savedPath: string;
  isApplied: boolean;
}> {
  const { workspaceRoot, apply = false, outputPath } = options;

  let productName = 'app';
  let productDesc = 'Web application';
  let entrypoint = 'http://localhost:3000';

  // 1. Inspect package.json
  const pkgJsonPath = path.join(workspaceRoot, 'package.json');
  try {
    const pkgContent = await fs.readFile(pkgJsonPath, 'utf8');
    const pkg = JSON.parse(pkgContent);
    if (pkg.name) productName = pkg.name;
    if (pkg.description) productDesc = pkg.description;
  } catch {
    // ignore missing package.json
  }

  // 2. Inspect README.md
  const readmePath = path.join(workspaceRoot, 'README.md');
  const readmeFeatures: string[] = [];
  try {
    const readmeContent = await fs.readFile(readmePath, 'utf8');
    const lines = readmeContent.split('\n');
    for (const line of lines) {
      const match = line.match(/^[-*]\s+\*\*([^*]+)\*\*:\s*(.+)$/) || line.match(/^[-*]\s+(.+)$/);
      if (match && readmeFeatures.length < 10) {
        readmeFeatures.push(match[1].trim());
      }
    }
  } catch {
    // ignore missing README.md
  }

  const requirements: Requirement[] = [];
  let reqCount = 1;

  const nextReqId = () => {
    const id = `R-${String(reqCount).padStart(3, '0')}`;
    reqCount++;
    return id;
  };

  // 3. Scan common frontend / API directories
  const candidateDirs = [
    'src/pages',
    'pages',
    'src/app',
    'app',
    'src/routes',
    'src/views',
    'src/components',
  ];

  for (const relDir of candidateDirs) {
    const fullDir = path.join(workspaceRoot, relDir);
    try {
      const entries = await fs.readdir(fullDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && /\.(tsx|jsx|vue|svelte|html|ts|js)$/.test(entry.name)) {
          const baseName = path.basename(entry.name, path.extname(entry.name));
          if (baseName.startsWith('_') || baseName === 'index' || baseName === 'layout') continue;

          const title = `${baseName.charAt(0).toUpperCase() + baseName.slice(1)} Page`;
          const filePath = `${relDir}/${entry.name}`;

          requirements.push({
            id: nextReqId(),
            title,
            statement: `Application provides ${baseName} user interface`,
            provenance: {
              type: 'inferred',
              inferredAt: new Date().toISOString(),
              sourceFiles: [filePath],
            },
            sources: [filePath],
            probes: [
              {
                type: 'file',
                path: filePath,
                mustExist: true,
              },
            ],
          });
        }
      }
    } catch {
      // Directory doesn't exist, continue
    }
  }

  // 4. Scan API endpoints
  const apiDirs = ['src/pages/api', 'pages/api', 'src/app/api', 'app/api', 'src/api', 'api'];
  for (const relApi of apiDirs) {
    const fullApi = path.join(workspaceRoot, relApi);
    try {
      const entries = await fs.readdir(fullApi, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && /\.(ts|js)$/.test(entry.name)) {
          const apiName = path.basename(entry.name, path.extname(entry.name));
          const apiFilePath = `${relApi}/${entry.name}`;
          const isHealth = apiName.includes('health') || apiName.includes('ping');

          const probes: Probe[] = [
            {
              type: 'file',
              path: apiFilePath,
              mustExist: true,
            },
          ];

          if (isHealth) {
            probes.push({
              type: 'http',
              url: `http://localhost:3000/api/${apiName}`,
              method: 'GET',
              expectStatus: 200,
            });
          }

          requirements.push({
            id: nextReqId(),
            title: `API /api/${apiName}`,
            statement: `Service provides /api/${apiName} endpoint`,
            provenance: {
              type: 'inferred',
              inferredAt: new Date().toISOString(),
              sourceFiles: [apiFilePath],
            },
            sources: [apiFilePath],
            probes,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // If no requirements discovered from file tree, use README features or placeholder
  if (requirements.length === 0) {
    if (readmeFeatures.length > 0) {
      for (const feat of readmeFeatures.slice(0, 3)) {
        requirements.push({
          id: nextReqId(),
          title: feat.slice(0, 40),
          statement: feat,
          provenance: {
            type: 'inferred',
            inferredAt: new Date().toISOString(),
            sourceFiles: ['README.md'],
          },
          sources: ['src/'],
        });
      }
    } else {
      requirements.push({
        id: 'R-001',
        title: 'Core Application Service',
        statement: 'Application starts and renders initial interface',
        provenance: {
          type: 'inferred',
          inferredAt: new Date().toISOString(),
        },
        sources: ['src/'],
        probes: [
          {
            type: 'file',
            path: 'package.json',
            mustExist: true,
          },
        ],
      });
    }
  }

  const contract: ProductContract = {
    version: '0.1',
    product: {
      name: productName,
      description: productDesc,
      entrypoint,
    },
    requirements,
    invariants: [
      {
        id: 'I-001',
        statement: 'Production credentials and secrets must not be checked into repository',
        sources: ['.env', 'src/'],
        probes: [
          {
            type: 'file',
            path: 'src/',
            notPattern: 'SECRET_KEY|DATABASE_URL|PRIVATE_KEY',
          },
        ],
      },
    ],
  };

  const targetFile = outputPath
    ? path.isAbsolute(outputPath)
      ? outputPath
      : path.join(workspaceRoot, outputPath)
    : path.join(workspaceRoot, apply ? DEFAULT_CONTRACT_FILE : INFERRED_CONTRACT_FILE);

  await saveContract(targetFile, contract);

  return {
    contract,
    savedPath: targetFile,
    isApplied: apply,
  };
}
