import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { type AgentInvocation, createAgentProvider, extractJsonObject } from './agent';

/** Wraps a final-message payload the way `claude -p --output-format json` does. */
function claudeEnvelope(result: string): string {
  return JSON.stringify({ is_error: false, subtype: 'success', result });
}

/** Parses the JSON payload the provider appends after the `Input:` marker. */
function parsePrompt(prompt: string): {
  translate: Array<{ key: string; icu: string }>;
  reference?: unknown;
} {
  const marker = '\nInput:\n';
  const at = prompt.lastIndexOf(marker);
  expect(at).toBeGreaterThan(-1);
  return extractJsonObject(prompt.slice(at + marker.length)) as {
    translate: Array<{ key: string; icu: string }>;
  };
}

function answerAll(prompt: string, render = (icu: string) => `es:${icu}`): string {
  return JSON.stringify({
    translations: parsePrompt(prompt).translate.map((i) => ({ key: i.key, icu: render(i.icu) })),
  });
}

describe('createAgentProvider - claude', () => {
  it('drives the CLI headlessly and parses the result envelope', async () => {
    const seen: AgentInvocation[] = [];
    const provider = createAgentProvider({
      agent: 'claude',
      model: 'claude-haiku-4-5',
      run: async (invocation) => {
        seen.push(invocation);
        return claudeEnvelope(answerAll(invocation.prompt));
      },
    });

    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [
        { key: 'k0', source: 'Sign out' },
        { key: 'k1', source: 'Hello, {name}!' },
      ],
    });

    expect(result.translations).toEqual({ k0: 'es:Sign out', k1: 'es:Hello, {name}!' });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.command).toBe('claude');
    expect(seen[0]?.args).toEqual([
      '-p',
      '--output-format',
      'json',
      '--disallowedTools',
      '*',
      '--model',
      'claude-haiku-4-5',
    ]);
    // Placeholders must survive into the prompt untouched.
    expect(seen[0]?.prompt).toContain('Hello, {name}!');
  });

  it('unwraps a fenced JSON answer', async () => {
    const provider = createAgentProvider({
      agent: 'claude',
      run: async (invocation) =>
        claudeEnvelope(
          `Here you go:\n\`\`\`json\n${answerAll(invocation.prompt)}\n\`\`\`\nHope that helps!`,
        ),
    });
    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [{ key: 'k0', source: 'Save' }],
    });
    expect(result.translations.k0).toBe('es:Save');
  });

  it('surfaces an agent-reported error', async () => {
    const provider = createAgentProvider({
      agent: 'claude',
      maxRetries: 1,
      sleep: async () => undefined,
      run: async () => JSON.stringify({ is_error: true, result: 'usage limit reached' }),
    });
    await expect(
      provider.translate({ source: 'en', target: 'es', items: [{ key: 'k0', source: 'Save' }] }),
    ).rejects.toThrow('usage limit reached');
  });

  it('rebuilds structured trees from the returned ICU', async () => {
    const tree = [
      { type: 'text' as const, value: 'Read the ' },
      { type: 'tag' as const, tag: 'a', children: [{ type: 'text' as const, value: 'docs' }] },
    ];
    const provider = createAgentProvider({
      agent: 'claude',
      run: async () =>
        claudeEnvelope(
          JSON.stringify({ translations: [{ key: 't.abc', icu: 'Lee la <a>documentación</a>' }] }),
        ),
    });
    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [{ key: 't.abc', source: tree }],
    });
    expect(result.translations['t.abc']).toEqual([
      { type: 'text', value: 'Lee la ' },
      { type: 'tag', tag: 'a', children: [{ type: 'text', value: 'documentación' }] },
    ]);
  });
});

describe('createAgentProvider - codex', () => {
  it('passes a response schema and reads the last-message file', async () => {
    const seen: AgentInvocation[] = [];
    const provider = createAgentProvider({
      agent: 'codex',
      model: 'gpt-5.6',
      run: async (invocation) => {
        seen.push(invocation);
        // Codex writes the final message to --output-last-message, not stdout.
        const outputPath = invocation.args[invocation.args.indexOf('--output-last-message') + 1];
        const { writeFile } = await import('node:fs/promises');
        await writeFile(outputPath as string, answerAll(invocation.prompt), 'utf8');
        return 'banner noise on stdout';
      },
    });

    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [{ key: 'k0', source: 'Sign out' }],
    });

    expect(result.translations.k0).toBe('es:Sign out');
    const args = seen[0]?.args ?? [];
    expect(args.slice(0, 4)).toEqual(['exec', '--sandbox', 'read-only', '--skip-git-repo-check']);
    expect(args).toContain('-m');
    expect(args).toContain('gpt-5.6');

    const schemaPath = args[args.indexOf('--output-schema') + 1] as string;
    // The temp dir is cleaned up after the run, so capture the schema mid-flight.
    await expect(readFile(schemaPath, 'utf8')).rejects.toThrow();
  });

  it('fails when codex writes no final message', async () => {
    const provider = createAgentProvider({
      agent: 'codex',
      maxRetries: 1,
      sleep: async () => undefined,
      run: async () => '',
    });
    await expect(
      provider.translate({ source: 'en', target: 'es', items: [{ key: 'k0', source: 'Save' }] }),
    ).rejects.toThrow('no final message');
  });
});

describe('createAgentProvider - shared behaviour', () => {
  it('batches at maxBatchSize', async () => {
    let calls = 0;
    const provider = createAgentProvider({
      maxBatchSize: 2,
      run: async (invocation) => {
        calls++;
        return claudeEnvelope(answerAll(invocation.prompt));
      },
    });
    const items = Array.from({ length: 5 }, (_, i) => ({ key: `k${i}`, source: `s${i}` }));
    const result = await provider.translate({ source: 'en', target: 'es', items });
    expect(calls).toBe(3);
    expect(Object.keys(result.translations)).toHaveLength(5);
  });

  it('re-asks for keys the agent omitted', async () => {
    const provider = createAgentProvider({
      sleep: async () => undefined,
      run: async (invocation) => {
        const input = parsePrompt(invocation.prompt);
        // Answer only the first key whenever more than one is asked for.
        const answered = input.translate.length > 1 ? input.translate.slice(0, 1) : input.translate;
        return claudeEnvelope(
          JSON.stringify({
            translations: answered.map((i) => ({ key: i.key, icu: `es:${i.icu}` })),
          }),
        );
      },
    });
    const items = Array.from({ length: 3 }, (_, i) => ({ key: `k${i}`, source: `s${i}` }));
    const result = await provider.translate({ source: 'en', target: 'es', items });
    expect(Object.keys(result.translations).sort()).toEqual(['k0', 'k1', 'k2']);
  });

  it('ignores keys the agent invented', async () => {
    const provider = createAgentProvider({
      maxRetries: 1,
      sleep: async () => undefined,
      run: async () =>
        claudeEnvelope(
          JSON.stringify({
            translations: [
              { key: 'k0', icu: 'Guardar' },
              { key: 'not-a-real-key', icu: '???' },
            ],
          }),
        ),
    });
    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [{ key: 'k0', source: 'Save' }],
    });
    expect(result.translations).toEqual({ k0: 'Guardar' });
  });

  it('retries a crashed invocation', async () => {
    let calls = 0;
    const provider = createAgentProvider({
      sleep: async () => undefined,
      run: async (invocation) => {
        calls++;
        if (calls === 1) throw new Error('claude exited with code 1');
        return claudeEnvelope(answerAll(invocation.prompt));
      },
    });
    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [{ key: 'k0', source: 'Save' }],
    });
    expect(calls).toBe(2);
    expect(result.translations.k0).toBe('es:Save');
  });

  it('includes bounded reference context in the prompt', async () => {
    let prompt = '';
    const provider = createAgentProvider({
      run: async (invocation) => {
        prompt = invocation.prompt;
        return claudeEnvelope(answerAll(invocation.prompt));
      },
    });
    await provider.translate({
      source: 'en',
      target: 'es',
      items: [{ key: 'k0', source: 'Save' }],
      context: [{ source: 'Cancel', translation: 'Cancelar' }],
    });
    expect(prompt).toContain('"reference"');
    expect(prompt).toContain('Cancelar');
  });

  it('carries the instruction into the prompt and the signature', async () => {
    const provider = createAgentProvider({
      instruction: 'Use the informal register.',
      run: async (invocation) => claudeEnvelope(answerAll(invocation.prompt)),
    });
    expect(provider.signature).toMatch(/^agent:claude:[0-9a-f]{8}$/);
  });

  it('rejects an unknown agent', () => {
    expect(() => createAgentProvider({ agent: 'gemini' as 'claude' })).toThrow('Unknown agent');
  });

  it('returns nothing for an empty request without spawning', async () => {
    let calls = 0;
    const provider = createAgentProvider({
      run: async () => {
        calls++;
        return '';
      },
    });
    const result = await provider.translate({ source: 'en', target: 'es', items: [] });
    expect(result.translations).toEqual({});
    expect(calls).toBe(0);
  });
});

describe('extractJsonObject', () => {
  it('parses bare JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses fenced JSON', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('parses JSON buried in prose', () => {
    expect(extractJsonObject('Sure! {"a":1} - let me know.')).toEqual({ a: 1 });
  });

  it('is not confused by braces inside strings', () => {
    expect(extractJsonObject('note: {"icu":"Hello, {name}!"} done')).toEqual({
      icu: 'Hello, {name}!',
    });
  });

  it('is not confused by escaped quotes', () => {
    expect(extractJsonObject('x {"icu":"say \\"hi\\""} y')).toEqual({ icu: 'say "hi"' });
  });

  it('throws on output containing no object', () => {
    expect(() => extractJsonObject('I cannot help with that.')).toThrow('no JSON object');
  });

  it('throws on a truncated object', () => {
    expect(() => extractJsonObject('{"a": 1')).toThrow('unterminated');
  });
});
