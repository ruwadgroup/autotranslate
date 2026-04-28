import type { Catalog, Locale } from '@autotranslate/core';

const inflight = new Map<string, Promise<void>>();

export interface NextStreamingOptions {
  readonly enabled?: boolean;
  readonly cwd?: string;
}

/**
 * `POST` handler that translates a new key on demand and writes it to the
 * chunked catalog. Mount at any API route. Returns 404 outside dev.
 */
export function createStreamingHandler(
  options: NextStreamingOptions = {},
): (request: Request) => Promise<Response> {
  const enabled = options.enabled ?? process.env.NODE_ENV !== 'production';
  const cwd = options.cwd ?? process.cwd();

  return async (request) => {
    if (!enabled) return new Response('Not found', { status: 404 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    let body: { key?: unknown; source?: unknown };
    try {
      body = (await request.json()) as { key?: unknown; source?: unknown };
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }
    const { key, source } = body;
    if (typeof key !== 'string' || typeof source !== 'string') {
      return new Response('expected { key: string, source: string }', { status: 400 });
    }

    const dedupe = `${key}::${source}`;
    let pending = inflight.get(dedupe);
    if (!pending) {
      pending = translateOne(cwd, key, source);
      inflight.set(dedupe, pending);
      pending.finally(() => inflight.delete(dedupe));
    }
    try {
      await pending;
      return new Response(null, { status: 204 });
    } catch (error) {
      return new Response(error instanceof Error ? error.message : 'unknown error', {
        status: 500,
      });
    }
  };
}

async function translateOne(cwd: string, key: string, source: string): Promise<void> {
  const cli = await import('@autotranslate/cli');
  const resolved = await cli.loadConfig(cwd);
  const { resolve, dirname } = await import('node:path');
  const sourceChunkPath = resolve(cwd, resolved.outDir, resolved.config.source, '_streaming.json');

  const { mkdir, readFile, writeFile } = await import('node:fs/promises');
  let existing: Catalog = {};
  try {
    existing = JSON.parse(await readFile(sourceChunkPath, 'utf8')) as Catalog;
  } catch (error) {
    if (
      !(error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ENOENT')
    ) {
      throw error;
    }
  }
  await mkdir(dirname(sourceChunkPath), { recursive: true });
  await writeFile(
    sourceChunkPath,
    `${JSON.stringify({ ...existing, [key]: source }, null, 2)}\n`,
    'utf8',
  );

  await cli.translate(resolved);
  await invalidateCatalogCache();
}

async function invalidateCatalogCache(): Promise<void> {
  const { clearCatalogCache } = await import('./catalog-loader');
  clearCatalogCache();
}

export function streamingPathFor(_locale: Locale): string {
  return '/api/__autotranslate/translate';
}

export const POST = createStreamingHandler();
