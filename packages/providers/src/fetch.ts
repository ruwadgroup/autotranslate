/**
 * Minimal `fetch` shape used by the network-bound providers. Modeled on the
 * Web Fetch API but defined here so the providers don't pull in DOM lib types
 * — Node 20+ ships a Fetch-compatible global that satisfies this contract.
 */
export interface FetchInit {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly signal?: AbortSignal;
}

export interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchLike = (input: string, init?: FetchInit) => Promise<FetchResponse>;

/** Resolve the runtime `fetch`. Throws when the environment doesn't ship one. */
export function defaultFetch(): FetchLike {
  const f = (globalThis as { fetch?: FetchLike }).fetch;
  if (!f) {
    throw new Error(
      'No global `fetch` is available. Pass a `fetch` implementation to the provider options.',
    );
  }
  return f;
}

export async function safeReadText(response: FetchResponse): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
