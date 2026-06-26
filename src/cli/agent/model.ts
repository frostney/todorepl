import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGateway, type LanguageModel } from "ai";

// Environment is injected (rather than read from `process.env` directly) so the
// resolver stays pure and testable.
export type ModelEnv = Record<string, string | undefined>;

// Where inference runs — drives the privacy banner:
//   on-device   → a loopback local model; nothing leaves the machine.
//   self-hosted → a non-loopback server the user configured (e.g. a LAN box).
//   cloud       → a managed third-party provider (anthropic/openai/gateway).
export type Placement = "on-device" | "self-hosted" | "cloud";

export type ResolvedModel = {
  readonly model: LanguageModel;
  readonly providerLabel: string;
  readonly modelId: string;
  readonly placement: Placement;
  // True only for the Ollama preset, whose /v1/models endpoint is reliable enough
  // to probe before launch. Other servers are not preflighted (an arbitrary
  // OpenAI-compatible server may gate or omit /models yet still serve chat).
  readonly preflight: boolean;
  // The server base URL, present for the ollama/openai-compatible path.
  readonly baseURL?: string;
};

const DEFAULT_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_LOCAL_MODEL = "llama3.1";
// `new URL(...).hostname` returns IPv6 loopback bracketed as "[::1]".
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

function placementFor(baseURL: string): Placement {
  try {
    return LOOPBACK_HOSTS.has(new URL(baseURL).hostname) ? "on-device" : "self-hosted";
  } catch {
    return "self-hosted";
  }
}

// Strips credentials and query/fragment from a URL for safe display in banners and
// logs, keeping only origin + path. A raw TODOREPL_BASE_URL may embed userinfo
// (https://user:token@host) or a signed query, which must never be printed.
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "the configured server URL";
  }
}

function firstKey(env: ModelEnv, names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

function requireKey(env: ModelEnv, names: readonly string[], provider: string): string {
  const key = firstKey(env, names);
  if (key === undefined) {
    throw new Error(
      `Provider "${provider}" needs an API key. Set ${names.join(" or ")}, ` +
        "or use the default local provider (unset TODOREPL_PROVIDER).",
    );
  }
  return key;
}

function requireModelId(env: ModelEnv, provider: string): string {
  const id = env.TODOREPL_MODEL;
  if (id === undefined || id === "") {
    throw new Error(`Provider "${provider}" needs a model id. Set TODOREPL_MODEL.`);
  }
  return id;
}

// Shared resolution for managed cloud providers (anthropic/openai), which differ
// only by their SDK factory and key env var.
function resolveHosted(
  env: ModelEnv,
  provider: string,
  keyEnv: string,
  build: (apiKey: string, modelId: string) => LanguageModel,
): ResolvedModel {
  const modelId = requireModelId(env, provider);
  const apiKey = requireKey(env, ["TODOREPL_API_KEY", keyEnv], provider);
  return {
    model: build(apiKey, modelId),
    providerLabel: provider,
    modelId,
    placement: "cloud",
    preflight: false,
  };
}

// Resolves the Vercel AI Gateway, which routes to many providers behind one key.
// Auth differs from the other cloud providers: TODOREPL_API_KEY / AI_GATEWAY_API_KEY,
// or a Vercel OIDC token, so it is resolved separately rather than via resolveHosted.
function resolveGateway(env: ModelEnv): ResolvedModel {
  const modelId = requireModelId(env, "gateway");
  const apiKey = firstKey(env, ["TODOREPL_API_KEY", "AI_GATEWAY_API_KEY"]);
  // An empty VERCEL_OIDC_TOKEN counts as absent (firstKey skips empty values).
  if (apiKey === undefined && firstKey(env, ["VERCEL_OIDC_TOKEN"]) === undefined) {
    throw new Error(
      'Provider "gateway" needs an API key. Set AI_GATEWAY_API_KEY (or TODOREPL_API_KEY), ' +
        "or run where a Vercel OIDC token (VERCEL_OIDC_TOKEN) is available.",
    );
  }
  const baseURL = firstKey(env, ["TODOREPL_BASE_URL"]);
  const gateway = createGateway({
    ...(apiKey !== undefined ? { apiKey } : {}),
    ...(baseURL !== undefined ? { baseURL } : {}),
  });
  return {
    model: gateway(modelId),
    providerLabel: "gateway",
    modelId,
    placement: "cloud",
    preflight: false,
  };
}

// Resolves the chat model from TODOREPL_* environment variables.
//
// The todo database always stays on the machine. The default (no configuration) is
// a local Ollama-compatible server, so nothing leaves the machine at all. Selecting
// `anthropic`, `openai`, or `gateway` is an explicit, opt-in choice to send the
// conversation (messages plus the todos the agent reads) to a third party for
// inference — never the database.
export function resolveModel(env: ModelEnv): ResolvedModel {
  const provider = firstKey(env, ["TODOREPL_PROVIDER"]) ?? "ollama";

  switch (provider) {
    case "ollama":
    case "openai-compatible": {
      const baseURL = firstKey(env, ["TODOREPL_BASE_URL"]) ?? DEFAULT_BASE_URL;
      const modelId = firstKey(env, ["TODOREPL_MODEL"]) ?? DEFAULT_LOCAL_MODEL;
      // Ollama ignores the key; other compatible servers may require one.
      const apiKey = firstKey(env, ["TODOREPL_API_KEY"]) ?? "todorepl";
      const compatible = createOpenAICompatible({ name: provider, baseURL, apiKey });
      return {
        model: compatible(modelId),
        providerLabel: `${provider} @ ${redactUrl(baseURL)}`,
        modelId,
        placement: placementFor(baseURL),
        preflight: provider === "ollama",
        baseURL,
      };
    }
    case "anthropic":
      return resolveHosted(env, provider, "ANTHROPIC_API_KEY", (apiKey, modelId) =>
        createAnthropic({ apiKey })(modelId),
      );
    case "openai":
      return resolveHosted(env, provider, "OPENAI_API_KEY", (apiKey, modelId) =>
        createOpenAI({ apiKey })(modelId),
      );
    case "gateway":
      return resolveGateway(env);
    default:
      throw new Error(
        `Unknown TODOREPL_PROVIDER "${provider}". ` +
          "Use one of: ollama, openai-compatible, anthropic, openai, gateway.",
      );
  }
}
