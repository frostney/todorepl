import { describe, expect, test } from "bun:test";
import type { Placement, ResolvedModel } from "./model";
import { privacyNotice } from "./privacy";

function resolved(placement: Placement): ResolvedModel {
  return {
    model: {} as ResolvedModel["model"],
    providerLabel: "x",
    modelId: "m",
    placement,
    preflight: false,
  };
}

describe("privacyNotice", () => {
  test("on-device: everything stays on the machine", () => {
    const text = privacyNotice(resolved("on-device"));
    expect(text).toMatch(/stay on this machine/i);
    expect(text).not.toContain("\n");
  });

  test("self-hosted: storage stays local; conversation goes to your own server", () => {
    const text = privacyNotice(resolved("self-hosted"));
    // Two distinct points: storage guarantee, then what is transmitted.
    expect(text).toContain("\n");
    expect(text).toMatch(/stay on this machine/i);
    expect(text).toMatch(/never uploads|never upload/i);
    expect(text).toMatch(/server you configured/i);
    // A self-hosted box is the user's own server, not a third-party provider.
    expect(text).not.toMatch(/provider/i);
  });

  test("cloud: keeps storage and inference as separate points", () => {
    const text = privacyNotice(resolved("cloud"));
    expect(text).toContain("\n");
    // Storage point — the database stays local and is not uploaded.
    expect(text).toMatch(/stay on this machine/i);
    expect(text).toMatch(/never uploads|never upload/i);
    // Inference point — only the conversation is sent to the provider.
    expect(text).toMatch(/sent to the provider/i);
    // Must not imply the todos themselves are stored off-device.
    expect(text).not.toMatch(/todos.*(stored|saved).*(off|elsewhere|remotely)/i);
  });
});
