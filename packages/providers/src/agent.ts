import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CatalogEntry } from '@autotranslate/core';
import { translateInBatches } from './batching';
import { icuToTree, treeToICU } from './tree-icu';
import type { Provider, TranslationItem, TranslationRequest } from './types';

/**
 * Coding agents that can run headless and are already authenticated on the
 * developer's machine. Translating through one costs nothing beyond the
 * subscription already being paid for, and needs no API key in CI config.
 */
export type AgentKind = 'claude' | 'codex';

export interface AgentProviderOptions {
  /** Which agent CLI to drive. Default `'claude'`. */
  readonly agent?: AgentKind;
  /** Model passed through to the agent (e.g. `'claude-haiku-4-5'`, `'gpt-5.6'`). */
  readonly model?: string;
  /** Override the executable. Defaults to the agent's own name on `PATH`. */
  readonly command?: string;
  /** Extra arguments appended before the prompt. */
  readonly args?: ReadonlyArray<string>;
  /** Hard timeout per invocation, in ms. Default 300000 (5 min). */
  readonly timeoutMs?: number;
  readonly instruction?: string;
  /** Items per agent invocation. Default 25. */
  readonly maxBatchSize?: number;
  /** Attempts per batch before giving up. Default 3. */
  readonly maxRetries?: number;
  /** Base delay in ms for exponential backoff between retries. Default 500. */
  readonly retryDelayMs?: number;
  /** Test seam replacing the actual process spawn. */
  readonly run?: AgentRunner;
  /** Test seam for backoff sleeps. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/** Runs one agent invocation and returns the agent's final message. */
export type AgentRunner = (invocation: AgentInvocation) => Promise<string>;

export interface AgentInvocation {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly prompt: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 300_000;

/**
 * Translate by driving a local coding agent (Claude Code or Codex) in headless
 * mode instead of calling a model API directly.
 *
 * The agent is used purely as a text transformer: no tools, no repository
 * access, prompt in on stdin and JSON out. That keeps it as predictable as the
 * HTTP providers while running on the developer's existing subscription.
 */
export function createAgentProvider(options: AgentProviderOptions = {}): Provider {
  const {
    agent = 'claude',
    model,
    instruction,
    run = spawnAgent,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;
  const adapter = ADAPTERS[agent];
  if (!adapter) {
    throw new Error(
      `Unknown agent '${agent}'. Expected one of: ${Object.keys(ADAPTERS).join(', ')}.`,
    );
  }
  const command = options.command ?? adapter.defaultCommand;
  const signature = `agent:${agent}${model ? `:${model}` : ''}${
    instruction ? `:${shortHash(instruction)}` : ''
  }`;

  return {
    name: 'agent',
    signature,
    async translate(request) {
      if (request.items.length === 0) return { translations: {} };
      const translations = await translateInBatches(
        request,
        (items, req) =>
          runBatch({
            adapter,
            command,
            ...(model !== undefined ? { model } : {}),
            extraArgs: options.args ?? [],
            timeoutMs,
            ...(instruction !== undefined ? { instruction } : {}),
            run,
            items,
            request: req,
          }),
        {
          ...(options.maxBatchSize !== undefined ? { batchSize: options.maxBatchSize } : {}),
          ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
          ...(options.retryDelayMs !== undefined ? { retryDelayMs: options.retryDelayMs } : {}),
          ...(options.sleep ? { sleep: options.sleep } : {}),
        },
      );
      return { translations };
    },
  };
}

interface RunBatchArgs {
  readonly adapter: AgentAdapter;
  readonly command: string;
  readonly model?: string;
  readonly extraArgs: ReadonlyArray<string>;
  readonly timeoutMs: number;
  readonly instruction?: string;
  readonly run: AgentRunner;
  readonly items: ReadonlyArray<TranslationItem>;
  readonly request: TranslationRequest;
}

async function runBatch(args: RunBatchArgs): Promise<Record<string, CatalogEntry>> {
  const { adapter, items, request } = args;
  const prompt = buildPrompt(items, request, args.instruction);

  const session = await adapter.prepare();
  try {
    const output = await args.run({
      command: args.command,
      args: [
        ...session.args,
        ...(args.model ? adapter.modelArgs(args.model) : []),
        ...args.extraArgs,
      ],
      prompt,
      timeoutMs: args.timeoutMs,
      ...(request.signal ? { signal: request.signal } : {}),
    });
    const payload = await session.read(output);
    return parseTranslations(payload, items);
  } finally {
    await session.cleanup();
  }
}

/**
 * Agents answer in prose-adjacent formats: fenced code blocks, a leading
 * "Here's the JSON", trailing notes. Pull the first balanced JSON object out
 * of whatever came back rather than trusting the whole string to parse.
 */
export function extractJsonObject(text: string): unknown {
  const trimmed = stripCodeFence(text.trim());
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to scanning
  }
  const start = trimmed.indexOf('{');
  if (start === -1) throw new Error(`agent returned no JSON object: ${preview(text)}`);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const candidate = trimmed.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch (error) {
          throw new Error(
            `agent returned malformed JSON: ${(error as Error).message} in ${preview(candidate)}`,
          );
        }
      }
    }
  }
  throw new Error(`agent returned an unterminated JSON object: ${preview(text)}`);
}

function stripCodeFence(text: string): string {
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/;
  const match = fence.exec(text);
  return match?.[1] ?? text;
}

function preview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 200 ? `${flat.slice(0, 200)}…` : flat;
}

function parseTranslations(
  payload: unknown,
  items: ReadonlyArray<TranslationItem>,
): Record<string, CatalogEntry> {
  const entries = (payload as { translations?: unknown })?.translations;
  if (!Array.isArray(entries)) {
    throw new Error("agent response is missing a 'translations' array");
  }
  const itemsByKey = new Map(items.map((i) => [i.key, i]));
  const out: Record<string, CatalogEntry> = {};
  for (const entry of entries) {
    const key = (entry as { key?: unknown })?.key;
    const icu = (entry as { icu?: unknown })?.icu;
    if (typeof key !== 'string' || typeof icu !== 'string') continue;
    const original = itemsByKey.get(key);
    // Unknown keys are hallucinations, not translations - drop them. Missing
    // ones are handled upstream by the repair pass.
    if (!original) continue;
    out[key] = typeof original.source === 'string' ? icu : icuToTree(icu);
  }
  return out;
}

function buildPrompt(
  items: ReadonlyArray<TranslationItem>,
  request: TranslationRequest,
  instruction: string | undefined,
): string {
  const translate = items.map((item) => ({
    key: item.key,
    icu: typeof item.source === 'string' ? item.source : treeToICU(item.source),
    ...(item.context ? { context: item.context } : {}),
    ...(item.description ? { description: item.description } : {}),
    ...(typeof item.maxChars === 'number' ? { maxChars: item.maxChars } : {}),
  }));
  const reference = (request.context ?? []).map((c) => ({
    icu: typeof c.source === 'string' ? c.source : treeToICU(c.source),
    translatedIcu: typeof c.translation === 'string' ? c.translation : treeToICU(c.translation),
  }));

  const lines = [
    `You are a professional translator. Translate ICU MessageFormat strings from ${request.source} to ${request.target}.`,
    '',
    'Rules:',
    '- Preserve every placeholder ({name}, {count, plural, ...}) and tag wrapper (<a>...</a>) exactly as written.',
    '- Preserve the overall ICU structure. Translate only the natural-language text.',
    '- Return one entry for EVERY key in "translate". Never omit, merge or invent keys.',
    '- Do not translate the keys themselves. They are opaque identifiers.',
  ];
  if (reference.length > 0) {
    lines.push(
      `- "reference" holds already-translated ${request.target} strings from the same product. Match their tone and terminology. Do NOT include them in your response.`,
    );
  }
  if (instruction) {
    lines.push('', `Additional guidance: ${instruction}`);
  }
  lines.push(
    '',
    'Do not use any tools. Do not read or write files. Answer directly.',
    'Respond with ONLY a JSON object of the form {"translations":[{"key":"<key>","icu":"<translated ICU>"}]} - no prose, no explanation.',
    '',
    'Input:',
    JSON.stringify(reference.length > 0 ? { reference, translate } : { translate }),
  );
  return lines.join('\n');
}

interface AgentSession {
  /** Arguments preceding the model and user-supplied ones. */
  readonly args: ReadonlyArray<string>;
  /** Turn raw agent stdout into the JSON payload text. */
  read(stdout: string): Promise<unknown>;
  cleanup(): Promise<void>;
}

interface AgentAdapter {
  readonly defaultCommand: string;
  modelArgs(model: string): ReadonlyArray<string>;
  prepare(): Promise<AgentSession>;
}

/** Shape both agents are asked to produce. Doubles as Codex's output schema. */
const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['translations'],
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'icu'],
        properties: { key: { type: 'string' }, icu: { type: 'string' } },
      },
    },
  },
};

const ADAPTERS: Readonly<Record<AgentKind, AgentAdapter>> = {
  /**
   * `claude -p --output-format json` prints an envelope whose `result` field
   * holds the final assistant message. Tools are disabled outright so the run
   * can never touch the repository or stall on a permission prompt.
   */
  claude: {
    defaultCommand: 'claude',
    modelArgs: (model) => ['--model', model],
    prepare: async () => ({
      args: ['-p', '--output-format', 'json', '--disallowedTools', '*'],
      read: async (stdout) => {
        const envelope = extractJsonObject(stdout) as {
          result?: unknown;
          is_error?: boolean;
          subtype?: string;
        };
        if (envelope.is_error === true) {
          throw new Error(`claude reported an error: ${preview(String(envelope.result ?? ''))}`);
        }
        if (typeof envelope.result !== 'string') {
          throw new Error("claude response is missing a string 'result' field");
        }
        return extractJsonObject(envelope.result);
      },
      cleanup: async () => undefined,
    }),
  },

  /**
   * `codex exec` enforces the response shape with `--output-schema` and writes
   * the final message to `--output-last-message`, so the banner and event noise
   * on stdout can be ignored entirely. Sandboxed read-only: translation needs
   * no repository access.
   */
  codex: {
    defaultCommand: 'codex',
    modelArgs: (model) => ['-m', model],
    prepare: async () => {
      const dir = await mkdtemp(join(tmpdir(), 'autotranslate-codex-'));
      const schemaPath = join(dir, 'schema.json');
      const outputPath = join(dir, 'out.json');
      await writeFile(schemaPath, JSON.stringify(RESPONSE_SCHEMA), 'utf8');
      return {
        args: [
          'exec',
          '--sandbox',
          'read-only',
          '--skip-git-repo-check',
          '--output-schema',
          schemaPath,
          '--output-last-message',
          outputPath,
          '-',
        ],
        read: async () => {
          const text = await readFile(outputPath, 'utf8').catch(() => '');
          if (text.trim() === '') {
            throw new Error('codex produced no final message');
          }
          return extractJsonObject(text);
        },
        cleanup: () => rm(dir, { recursive: true, force: true }),
      };
    },
  },
};

/**
 * Spawn the agent with the prompt on stdin. No shell: arguments go across as
 * an argv array, so nothing in the source copy can be interpreted as a command.
 */
const spawnAgent: AgentRunner = (invocation) =>
  new Promise((resolve, reject) => {
    const child = spawn(invocation.command, [...invocation.args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      invocation.signal?.removeEventListener('abort', onAbort);
      fn();
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(() =>
        reject(
          new Error(
            `${invocation.command} timed out after ${invocation.timeoutMs}ms. ` +
              'Lower `batchSize` or raise `timeoutMs`.',
          ),
        ),
      );
    }, invocation.timeoutMs);

    const onAbort = () => {
      child.kill('SIGTERM');
      const error = new Error('aborted');
      error.name = 'AbortError';
      finish(() => reject(error));
    };
    invocation.signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d: string) => {
      stdout += d;
    });
    child.stderr.on('data', (d: string) => {
      stderr += d;
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      finish(() =>
        reject(
          error.code === 'ENOENT'
            ? new Error(
                `'${invocation.command}' was not found on PATH. Install the agent CLI or set ` +
                  '`provider.command` to its full path.',
              )
            : error,
        ),
      );
    });

    child.on('close', (code) => {
      finish(() => {
        if (code === 0) resolve(stdout);
        else
          reject(
            new Error(
              `${invocation.command} exited with code ${code}: ${preview(stderr || stdout)}`,
            ),
          );
      });
    });

    child.stdin.on('error', () => {
      // The agent can exit before consuming stdin; `close` reports the real error.
    });
    child.stdin.end(invocation.prompt);
  });

// FNV-1a 32-bit. Non-cryptographic; used only to give the instruction a stable
// signature. Avoids pulling in node:crypto.
function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
