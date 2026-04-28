import { resolve } from 'node:path';
import type { Locale } from '@autotranslate/core';
import type { ViteDevServer } from 'vite';

const ENDPOINT = '/__autotranslate/translate';
const inflight = new Map<string, Promise<void>>();

/**
 * Vite middleware that translates a single (key, source) on demand and
 * writes it to the chunked catalog. Lazy-loads `@autotranslate/cli` and
 * the resolved provider so dev startup isn't penalised when streaming is
 * unused.
 */
export function attachStreamingMiddleware(server: ViteDevServer, cwd: string): void {
  server.middlewares.use(ENDPOINT, async (req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end();
      return;
    }
    try {
      const body = await readJson(req);
      const { key, source } = body as { key?: string; source?: string };
      if (typeof key !== 'string' || typeof source !== 'string') {
        res.statusCode = 400;
        res.end('expected { key: string, source: string }');
        return;
      }
      const dedupe = `${key}::${source}`;
      let pending = inflight.get(dedupe);
      if (!pending) {
        pending = translateOne(cwd, key, source);
        inflight.set(dedupe, pending);
        pending.finally(() => inflight.delete(dedupe));
      }
      await pending;
      res.statusCode = 204;
      res.end();
    } catch (error) {
      res.statusCode = 500;
      res.end(error instanceof Error ? error.message : 'unknown error');
    }
  });
}

async function translateOne(cwd: string, key: string, source: string): Promise<void> {
  const cli = await import('@autotranslate/cli');
  const resolved = await cli.loadConfig(cwd);
  const sourceDir = resolve(cwd, resolved.outDir, resolved.config.source);
  const sourceChunkPath = resolve(sourceDir, '_streaming.json');
  await mergeIntoChunk(sourceChunkPath, { [key]: source });

  // Run translate against just this key — the cache will hit if it's already known.
  await cli.translate(resolved);
}

async function mergeIntoChunk(path: string, additions: Record<string, string>): Promise<void> {
  const { mkdir, readFile, writeFile } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  let existing: Record<string, string> = {};
  try {
    existing = JSON.parse(await readFile(path, 'utf8')) as Record<string, string>;
  } catch (error) {
    if (
      !(error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ENOENT')
    ) {
      throw error;
    }
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ ...existing, ...additions }, null, 2)}\n`, 'utf8');
}

async function readJson(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

export function streamingEndpointFor(_locale: Locale): string {
  return ENDPOINT;
}
