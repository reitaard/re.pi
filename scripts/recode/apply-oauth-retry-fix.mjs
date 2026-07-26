import fs from "node:fs";

function read(path) {
	return fs.readFileSync(path, "utf8");
}

function write(path, content) {
	fs.writeFileSync(path, content, "utf8");
}

function replaceOnce(source, before, after, label) {
	const first = source.indexOf(before);
	if (first === -1) throw new Error(`Missing patch target: ${label}`);
	if (source.indexOf(before, first + before.length) !== -1) {
		throw new Error(`Patch target is not unique: ${label}`);
	}
	return source.slice(0, first) + after + source.slice(first + before.length);
}

const retrySource = `const DEFAULT_MAX_RETRY_DELAY_MS = 60_000;

interface ProviderRetryOptions {
\tmaxRetries?: number;
\tmaxRetryDelayMs?: number;
\tsignal?: AbortSignal;
}

interface ProviderError extends Error {
\tstatus: number | undefined;
\theaders: Headers | undefined;
}

function isProviderError(error: unknown): error is ProviderError {
\tif (!(error instanceof Error) || !("status" in error) || !("headers" in error)) return false;
\treturn (
\t\t(error.status === undefined || typeof error.status === "number") &&
\t\t(error.headers === undefined || error.headers instanceof Headers)
\t);
}

function isUsageLimitReachedError(error: ProviderError): boolean {
\tif (error.status !== 429) return false;
\tconst message = error.message.toLowerCase();
\treturn message.includes("usage_limit_reached") || message.includes("usage limit has been reached");
}

/** Mirrors the pinned OpenAI/Anthropic SDK retry policy; review when either SDK is upgraded. */
function isRetryableProviderError(error: ProviderError): boolean {
\t// OAuth subscription windows can be hours or days long. The proxy already
\t// includes the reset timestamp in the error body, so retrying the same request
\t// only duplicates the error and consumes time without any chance of success.
\tif (isUsageLimitReachedError(error)) return false;

\tconst shouldRetry = error.headers?.get("x-should-retry");
\tif (shouldRetry === "true") return true;
\tif (shouldRetry === "false") return false;

\tif (error.status === undefined) return true;
\treturn (
\t\terror.status === 408 ||
\t\terror.status === 409 ||
\t\terror.status === 429 ||
\t\t(typeof error.status === "number" && error.status >= 500)
\t);
}

function validateServerRetryDelayMs(
\tdelayMs: number,
\tmaxRetryDelayMs: number | undefined,
\tproviderErrorMessage: string,
): number {
\tconst maxDelayMs = maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
\tif (maxDelayMs > 0 && delayMs > maxDelayMs) {
\t\tthrow new Error(
\t\t\t\`Server requested \${Math.ceil(delayMs / 1000)}s retry delay (max: \${Math.ceil(maxDelayMs / 1000)}s). \${providerErrorMessage}\`,
\t\t);
\t}
\treturn delayMs;
}

function getRetryDelayMs(error: ProviderError, retryIndex: number, maxRetryDelayMs: number | undefined): number {
\tconst retryAfterMs = error.headers?.get("retry-after-ms");
\tif (retryAfterMs) {
\t\tconst value = Number.parseFloat(retryAfterMs);
\t\tif (!Number.isNaN(value)) return validateServerRetryDelayMs(value, maxRetryDelayMs, error.message);
\t}

\tconst retryAfter = error.headers?.get("retry-after");
\tif (retryAfter) {
\t\tconst seconds = Number.parseFloat(retryAfter);
\t\tconst delayMs = Number.isNaN(seconds) ? Date.parse(retryAfter) - Date.now() : seconds * 1000;
\t\treturn validateServerRetryDelayMs(delayMs, maxRetryDelayMs, error.message);
\t}

\tconst exponentialDelay = Math.min(0.5 * 2 ** retryIndex, 8) * 1000;
\treturn exponentialDelay * (1 - Math.random() * 0.25);
}

function createAbortError(): Error {
\tconst error = new Error("Request aborted");
\terror.name = "AbortError";
\treturn error;
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
\treturn new Promise((resolve, reject) => {
\t\tif (signal?.aborted) {
\t\t\treject(createAbortError());
\t\t\treturn;
\t\t}

\t\tconst onAbort = () => {
\t\t\tclearTimeout(timeout);
\t\t\treject(createAbortError());
\t\t};
\t\tconst timeout = setTimeout(
\t\t\t() => {
\t\t\t\tsignal?.removeEventListener("abort", onAbort);
\t\t\t\tresolve();
\t\t\t},
\t\t\tMath.max(0, ms),
\t\t);
\t\tsignal?.addEventListener("abort", onAbort, { once: true });
\t});
}

/**
 * Reproduce the retry behavior used by the OpenAI and Anthropic SDKs while making
 * their backoff sleep interruptible. Their built-in retry timers ignore the
 * request AbortSignal, so callers must invoke the SDK with maxRetries: 0 and
 * wrap the request with this helper. Provider-requested delays above
 * maxRetryDelayMs fail immediately (60 seconds by default); set it to zero to
 * disable the limit.
 */
export async function retryProviderRequest<T>(
\trequest: () => Promise<T>,
\toptions: ProviderRetryOptions = {},
): Promise<T> {
\tconst maxRetries = options.maxRetries ?? 0;
\tlet retriesRemaining = maxRetries;

\tfor (;;) {
\t\ttry {
\t\t\treturn await request();
\t\t} catch (error) {
\t\t\tif (options.signal?.aborted) throw createAbortError();
\t\t\tif (retriesRemaining <= 0 || !isProviderError(error) || !isRetryableProviderError(error)) throw error;

\t\t\tconst retryIndex = maxRetries - retriesRemaining;
\t\t\tretriesRemaining--;
\t\t\tawait abortableSleep(getRetryDelayMs(error, retryIndex, options.maxRetryDelayMs), options.signal);
\t\t}
\t}
}
`;

const retryTest = `import { afterEach, describe, expect, it, vi } from "vitest";
import { retryProviderRequest } from "../src/utils/provider-retry.ts";

function providerError(status: number | undefined, headers?: Record<string, string>, message?: string): Error {
\treturn Object.assign(new Error(message ?? \`Provider error: \${status}\`), {
\t\tstatus,
\t\theaders: new Headers(headers),
\t});
}

describe("provider request retries", () => {
\tafterEach(() => {
\t\tvi.useRealTimers();
\t});

\tit("retries retryable provider errors", async () => {
\t\tvi.useFakeTimers();
\t\tconst request = vi
\t\t\t.fn<() => Promise<string>>()
\t\t\t.mockRejectedValueOnce(providerError(429, { "retry-after-ms": "1000" }))
\t\t\t.mockResolvedValue("ok");

\t\tconst result = retryProviderRequest(request, { maxRetries: 1 });
\t\tawait vi.advanceTimersByTimeAsync(999);
\t\texpect(request).toHaveBeenCalledTimes(1);
\t\tawait vi.advanceTimersByTimeAsync(1);

\t\tawait expect(result).resolves.toBe("ok");
\t\texpect(request).toHaveBeenCalledTimes(2);
\t});

\tit("does not retry exhausted OAuth subscription windows", async () => {
\t\tconst error = providerError(
\t\t\t429,
\t\t\tundefined,
\t\t\t'OpenAI API error (429): {"type":"usage_limit_reached","message":"The usage limit has been reached","plan_type":"plus","resets_in_seconds":325874}',
\t\t);
\t\tconst request = vi.fn<() => Promise<string>>().mockRejectedValue(error);

\t\tawait expect(retryProviderRequest(request, { maxRetries: 3 })).rejects.toBe(error);
\t\texpect(request).toHaveBeenCalledTimes(1);
\t});

\tit("does not retry errors the provider marks as non-retryable", async () => {
\t\tconst error = providerError(429, { "x-should-retry": "false" });
\t\tconst request = vi.fn<() => Promise<string>>().mockRejectedValue(error);

\t\tawait expect(retryProviderRequest(request, { maxRetries: 2 })).rejects.toBe(error);
\t\texpect(request).toHaveBeenCalledTimes(1);
\t});

\tit("rejects a provider-requested retry delay above the limit", async () => {
\t\tconst request = vi.fn<() => Promise<string>>().mockRejectedValue(providerError(429, { "retry-after": "277403" }));

\t\tawait expect(retryProviderRequest(request, { maxRetries: 1, maxRetryDelayMs: 1000 })).rejects.toThrow(
\t\t\t"Server requested 277403s retry delay (max: 1s)",
\t\t);
\t\texpect(request).toHaveBeenCalledTimes(1);
\t});

\tit("allows disabling the provider-requested retry delay cap", async () => {
\t\tvi.useFakeTimers();
\t\tconst request = vi
\t\t\t.fn<() => Promise<string>>()
\t\t\t.mockRejectedValueOnce(providerError(429, { "retry-after": "2" }))
\t\t\t.mockResolvedValue("ok");

\t\tconst result = retryProviderRequest(request, { maxRetries: 1, maxRetryDelayMs: 0 });
\t\tawait vi.advanceTimersByTimeAsync(1999);
\t\texpect(request).toHaveBeenCalledTimes(1);
\t\tawait vi.advanceTimersByTimeAsync(1);

\t\tawait expect(result).resolves.toBe("ok");
\t\texpect(request).toHaveBeenCalledTimes(2);
\t});

\tit("aborts a provider-requested retry delay", async () => {
\t\tvi.useFakeTimers();
\t\tconst controller = new AbortController();
\t\tconst request = vi.fn<() => Promise<string>>().mockRejectedValue(providerError(429, { "retry-after": "277403" }));

\t\tconst result = retryProviderRequest(request, { maxRetries: 2, maxRetryDelayMs: 0, signal: controller.signal });
\t\tawait vi.advanceTimersByTimeAsync(0);
\t\texpect(request).toHaveBeenCalledTimes(1);
\t\texpect(vi.getTimerCount()).toBe(1);

\t\tcontroller.abort();

\t\tawait expect(result).rejects.toMatchObject({ name: "AbortError" });
\t\texpect(request).toHaveBeenCalledTimes(1);
\t\texpect(vi.getTimerCount()).toBe(0);
\t});
});
`;

write("packages/ai/src/utils/provider-retry.ts", retrySource);
write("packages/ai/test/provider-retry.test.ts", retryTest);

let responses = read("packages/ai/src/api/openai-responses.ts");
responses = replaceOnce(
	responses,
	'import { getProviderEnvValue } from "../utils/provider-env.ts";\n',
	'import { getProviderEnvValue } from "../utils/provider-env.ts";\nimport { retryProviderRequest } from "../utils/provider-retry.ts";\n',
	"OpenAI Responses retry import",
);
responses = replaceOnce(
	responses,
	"\t\t\t\tmaxRetries: options?.maxRetries ?? 0,\n",
	"\t\t\t\tmaxRetries: 0,\n",
	"disable SDK-owned retries",
);
responses = replaceOnce(
	responses,
	"\t\t\tconst { data: openaiStream, response } = await client.responses.create(params, requestOptions).withResponse();\n",
	`\t\t\tconst { data: openaiStream, response } = await retryProviderRequest(
\t\t\t\t() => client.responses.create(params, requestOptions).withResponse(),
\t\t\t\t{
\t\t\t\t\tmaxRetries: options?.maxRetries,
\t\t\t\t\tmaxRetryDelayMs: options?.maxRetryDelayMs,
\t\t\t\t\tsignal: options?.signal,
\t\t\t\t},
\t\t\t);
`,
	"wrap OpenAI Responses request",
);
write("packages/ai/src/api/openai-responses.ts", responses);

let provider = read("packages/coding-agent/src/recode-openai-oauth.ts");
provider = replaceOnce(
	provider,
	`function fallbackContextWindow(id: string): number {
\tif (/^gpt-5\\.6(?:-|$)/i.test(id)) return 372000;
\tif (/^gpt-5(?:[.-]|$)/i.test(id)) return 272000;
\treturn 32768;
}

function fallbackMaxTokens(id: string): number {
\treturn /^gpt-5(?:[.-]|$)/i.test(id) ? 128000 : 8192;
}
`,
	`function inferredContextWindow(id: string): number | undefined {
\tif (/^gpt-5\\.6(?:-|$)/i.test(id)) return 372000;
\tif (/^gpt-5(?:[.-]|$)/i.test(id)) return 272000;
\treturn undefined;
}

function inferredMaxTokens(id: string): number | undefined {
\treturn /^gpt-5(?:[.-]|$)/i.test(id) ? 128000 : undefined;
}
`,
	"OAuth model metadata inference helpers",
);
provider = replaceOnce(
	provider,
	`\t\tcontextWindow: model.contextWindow ?? known?.contextWindow ?? fallbackContextWindow(model.id),
\t\tmaxTokens: model.maxTokens ?? known?.maxTokens ?? fallbackMaxTokens(model.id),
`,
	`\t\t// The proxy is authoritative when it reports metadata. Family inference
\t\t// covers aliases such as Sol/Terra/Luna before falling back to the catalog.
\t\tcontextWindow: model.contextWindow ?? inferredContextWindow(model.id) ?? known?.contextWindow ?? 32768,
\t\tmaxTokens: model.maxTokens ?? inferredMaxTokens(model.id) ?? known?.maxTokens ?? 8192,
`,
	"OAuth model metadata precedence",
);
write("packages/coding-agent/src/recode-openai-oauth.ts", provider);

let providerTest = read("packages/coding-agent/test/recode-openai-oauth.test.ts");
providerTest = replaceOnce(
	providerTest,
	'\t\t\t\t\t\t{ id: "gpt-5.6-sol" },\n',
	'\t\t\t\t\t\t{ id: "gpt-5.6-sol", context_window: 400000, max_tokens: 64000 },\n',
	"OAuth proxy metadata fixture",
);
providerTest = replaceOnce(
	providerTest,
	`\t\tconst terra = registeredProvider?.models?.find((model) => model.id === "gpt-5.6-terra");
`,
	`\t\tconst sol = registeredProvider?.models?.find((model) => model.id === "gpt-5.6-sol");
\t\texpect(sol).toMatchObject({
\t\t\tcontextWindow: 400000,
\t\t\tmaxTokens: 64000,
\t\t});

\t\tconst terra = registeredProvider?.models?.find((model) => model.id === "gpt-5.6-terra");
`,
	"OAuth proxy metadata assertion",
);
write("packages/coding-agent/test/recode-openai-oauth.test.ts", providerTest);

console.log("Applied isolated Recode 0.81.4 OAuth retry patch.");
