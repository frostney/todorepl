import { env, stderr } from "node:process";
import { type AgentTUIAgent, runAgentTUI } from "@ai-sdk/tui";
import { ToolLoopAgent } from "ai";
import { createCategoryService } from "../app/category-service";
import { createTodoService } from "../app/todo-service";
import { buildInstructions } from "./agent/instructions";
import { type ResolvedModel, redactUrl, resolveModel } from "./agent/model";
import { privacyNotice } from "./agent/privacy";
import { createAgentTools } from "./agent/tools";
import { type AppContext, createAppContext } from "./context";

const TITLE = "todorepl";
const PREFLIGHT_TIMEOUT_MS = 1_500;

// Probes a URL with a short timeout so a missing server produces a clear hint
// instead of an opaque request failure mid-session.
async function modelServerReachable(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function reportUnreachable(baseURL: string): void {
  stderr.write(
    `Could not reach a local model server at ${redactUrl(baseURL)}.\n` +
      "Start Ollama with `ollama serve` and pull a model (e.g. `ollama pull llama3.1`),\n" +
      "or set TODOREPL_PROVIDER=anthropic|openai|gateway with an API key to use a hosted model.\n",
  );
}

// Resolves the model, reporting configuration errors to stderr. Returns null when
// the agent should not start.
function resolveOrReport(): ResolvedModel | null {
  try {
    return resolveModel(env);
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return null;
  }
}

// Confirms the model server is reachable, printing guidance when it is not. Only
// the Ollama preset is probed (resolved.preflight); other providers — including
// arbitrary OpenAI-compatible servers that may gate or omit /models — are launched
// directly and surface failures at request time.
async function localServerReady(resolved: ResolvedModel): Promise<boolean> {
  if (!resolved.preflight || resolved.baseURL === undefined) return true;
  // Join robustly so a trailing slash on the base URL doesn't yield "/v1//models".
  const modelsUrl = `${resolved.baseURL.replace(/\/+$/, "")}/models`;
  if (await modelServerReachable(modelsUrl)) return true;
  reportUnreachable(resolved.baseURL);
  return false;
}

// The interactive entry point: an AI agent terminal UI backed by the same todo and
// category services the subcommands use. Replaces the former line-based REPL.
export async function startAgentRepl(context: AppContext = createAppContext()): Promise<void> {
  const resolved = resolveOrReport();
  if (resolved === null) {
    process.exitCode = 1;
    return;
  }

  stderr.write(`todorepl — ${resolved.providerLabel} · ${resolved.modelId}\n`);
  stderr.write(`${privacyNotice(resolved)}\n`);

  if (!(await localServerReady(resolved))) {
    process.exitCode = 1;
    return;
  }

  const repo = context.openStore();
  try {
    const agent = new ToolLoopAgent({
      model: resolved.model,
      instructions: buildInstructions(context.clock),
      tools: createAgentTools({
        todos: createTodoService(repo, context.clock),
        categories: createCategoryService(repo, context.clock),
        repo,
      }),
    });
    // The SDK's TUI agent type predates exactOptionalPropertyTypes; ToolLoopAgent
    // satisfies it structurally, so the assertion is safe.
    await runAgentTUI({ agent: agent as AgentTUIAgent, title: TITLE, tools: "auto-collapsed" });
  } finally {
    repo.close();
  }
}
