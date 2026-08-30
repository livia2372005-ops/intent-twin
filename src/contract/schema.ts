import { z } from 'zod';

export const HttpProbeSchema = z.object({
  type: z.literal('http'),
  url: z.string().min(1, 'URL cannot be empty'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional().default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  expectStatus: z.number().int().optional().default(200),
  expectJsonMatch: z.record(z.any()).optional(),
  timeoutMs: z.number().int().positive().optional().default(5000),
});

export const FileProbeSchema = z.object({
  type: z.literal('file'),
  path: z.string().min(1, 'Path cannot be empty'),
  pattern: z.string().optional(),
  notPattern: z.string().optional(),
  mustExist: z.boolean().optional().default(true),
});

export const BehavioralProbeSchema = z.object({
  type: z.literal('behavioral'),
  script: z.string().min(1, 'Script cannot be empty'),
  timeoutMs: z.number().int().positive().optional().default(15000),
});

export const ExecProbeSchema = z.object({
  type: z.literal('exec'),
  command: z.string().min(1, 'Command cannot be empty'),
  cwd: z.string().optional(),
  expectExitCode: z.number().int().optional().default(0),
  expectOutputPattern: z.string().optional(),
  timeoutMs: z.number().int().positive().optional().default(10000),
});

export const ProbeSchema = z.discriminatedUnion('type', [
  HttpProbeSchema,
  FileProbeSchema,
  BehavioralProbeSchema,
  ExecProbeSchema,
]);

export const RequirementProvenanceSchema = z.object({
  type: z.enum(['inferred', 'manual', 'verified']).default('manual'),
  inferredAt: z.string().optional(),
  sourceFiles: z.array(z.string()).optional(),
});

export const RequirementSchema = z.object({
  id: z.string().regex(/^R-[0-9A-Za-z_-]+$/, 'Requirement ID must follow pattern R-xxx (e.g. R-001)'),
  title: z.string().min(1, 'Title cannot be empty'),
  statement: z.string().min(1, 'Statement cannot be empty'),
  critical: z.boolean().optional().default(false),
  provenance: RequirementProvenanceSchema.optional(),
  sources: z.array(z.string()).optional().default([]),
  probes: z.array(ProbeSchema).optional().default([]),
});

export const InvariantSchema = z.object({
  id: z.string().regex(/^I-[0-9A-Za-z_-]+$/, 'Invariant ID must follow pattern I-xxx (e.g. I-001)'),
  statement: z.string().min(1, 'Statement cannot be empty'),
  sources: z.array(z.string()).optional().default([]),
  probes: z.array(ProbeSchema).optional().default([]),
});

export const ProductContractSchema = z.object({
  version: z.literal('0.1').default('0.1'),
  product: z.object({
    name: z.string().min(1, 'Product name cannot be empty'),
    description: z.string().optional(),
    entrypoint: z.string().optional(),
  }),
  requirements: z.array(RequirementSchema).default([]),
  invariants: z.array(InvariantSchema).optional().default([]),
});

export type RawProductContract = z.input<typeof ProductContractSchema>;
