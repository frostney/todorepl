import { describe, expect, test } from "bun:test";
import { type ModelEnv, resolveModel } from "./model";

describe("resolveModel", () => {
  test("defaults to a local Ollama-compatible server with no configuration", () => {
    const resolved = resolveModel({});
    expect(resolved.placement).toBe("on-device");
    expect(resolved.modelId).toBe("llama3.1");
    expect(resolved.baseURL).toBe("http://localhost:11434/v1");
    expect(resolved.providerLabel).toContain("ollama");
  });

  test("never selects a cloud provider implicitly", () => {
    // The whole point of the local default: an unconfigured install keeps data on-device.
    expect(resolveModel({}).placement).toBe("on-device");
    expect(resolveModel({ TODOREPL_MODEL: "qwen2.5" }).placement).toBe("on-device");
  });

  test("honours a custom local model id", () => {
    expect(resolveModel({ TODOREPL_MODEL: "qwen2.5" }).modelId).toBe("qwen2.5");
  });

  test("preflights the Ollama preset but not a generic OpenAI-compatible server", () => {
    expect(resolveModel({}).preflight).toBe(true);
    expect(
      resolveModel({ TODOREPL_PROVIDER: "openai-compatible", TODOREPL_API_KEY: "k" }).preflight,
    ).toBe(false);
  });

  test("classifies a non-loopback local server as self-hosted, not cloud", () => {
    const env: ModelEnv = {
      TODOREPL_PROVIDER: "ollama",
      TODOREPL_BASE_URL: "http://192.168.1.10:11434/v1",
    };
    expect(resolveModel(env).placement).toBe("self-hosted");
  });

  test("treats a remote openai-compatible endpoint as self-hosted", () => {
    const env: ModelEnv = {
      TODOREPL_PROVIDER: "openai-compatible",
      TODOREPL_BASE_URL: "https://api.example.com/v1",
      TODOREPL_API_KEY: "secret",
    };
    expect(resolveModel(env).placement).toBe("self-hosted");
  });

  test("resolves Anthropic when fully configured", () => {
    const resolved = resolveModel({
      TODOREPL_PROVIDER: "anthropic",
      TODOREPL_MODEL: "claude-sonnet-4-5",
      ANTHROPIC_API_KEY: "secret",
    });
    expect(resolved.placement).toBe("cloud");
    expect(resolved.providerLabel).toBe("anthropic");
    expect(resolved.modelId).toBe("claude-sonnet-4-5");
  });

  test("resolves OpenAI using a generic TODOREPL_API_KEY", () => {
    const resolved = resolveModel({
      TODOREPL_PROVIDER: "openai",
      TODOREPL_MODEL: "gpt-4o",
      TODOREPL_API_KEY: "secret",
    });
    expect(resolved.placement).toBe("cloud");
    expect(resolved.providerLabel).toBe("openai");
  });

  test("requires a model id for cloud providers", () => {
    expect(() => resolveModel({ TODOREPL_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" })).toThrow(
      "model id",
    );
  });

  test("requires an API key for cloud providers", () => {
    expect(() => resolveModel({ TODOREPL_PROVIDER: "openai", TODOREPL_MODEL: "gpt-4o" })).toThrow(
      "API key",
    );
  });

  test("resolves the Vercel AI Gateway with an API key", () => {
    const resolved = resolveModel({
      TODOREPL_PROVIDER: "gateway",
      TODOREPL_MODEL: "anthropic/claude-sonnet-4.6",
      AI_GATEWAY_API_KEY: "secret",
    });
    expect(resolved.placement).toBe("cloud");
    expect(resolved.providerLabel).toBe("gateway");
    expect(resolved.modelId).toBe("anthropic/claude-sonnet-4.6");
  });

  test("allows the gateway to authenticate via a Vercel OIDC token", () => {
    const resolved = resolveModel({
      TODOREPL_PROVIDER: "gateway",
      TODOREPL_MODEL: "openai/gpt-4o",
      VERCEL_OIDC_TOKEN: "oidc-token",
    });
    expect(resolved.providerLabel).toBe("gateway");
    expect(resolved.placement).toBe("cloud");
  });

  test("treats an empty OIDC token as missing auth", () => {
    expect(() =>
      resolveModel({
        TODOREPL_PROVIDER: "gateway",
        TODOREPL_MODEL: "openai/gpt-4o",
        VERCEL_OIDC_TOKEN: "",
      }),
    ).toThrow("API key");
  });

  test("requires gateway auth when neither an API key nor OIDC token is present", () => {
    expect(() =>
      resolveModel({ TODOREPL_PROVIDER: "gateway", TODOREPL_MODEL: "openai/gpt-4o" }),
    ).toThrow("API key");
  });

  test("requires a model id for the gateway", () => {
    expect(() =>
      resolveModel({ TODOREPL_PROVIDER: "gateway", AI_GATEWAY_API_KEY: "secret" }),
    ).toThrow("model id");
  });

  test("rejects an unknown provider", () => {
    expect(() => resolveModel({ TODOREPL_PROVIDER: "bogus" })).toThrow("Unknown TODOREPL_PROVIDER");
  });
});
