import type { ResolvedModel } from "./model";

// The startup banner must keep two facts separate, because users conflate them:
//
//   1. Storage — the todo database always lives on this machine. todorepl never
//      uploads or syncs it, no matter which model is selected.
//   2. Inference — a remote model receives only the live conversation (the user's
//      messages plus the todos the agent reads to answer), never the database.
//
// "sent off this machine" alone wrongly implies todos are stored elsewhere, so the
// remote notices state the storage guarantee first and the transmission second. A
// self-hosted server (the user's own non-loopback box) is distinguished from a
// managed third-party cloud so the wording stays accurate for each.
export function privacyNotice(resolved: ResolvedModel): string {
  switch (resolved.placement) {
    case "on-device":
      return "Local model — your todos and messages stay on this machine; nothing leaves it.";
    case "self-hosted":
      return (
        "Storage — your todos stay on this machine; todorepl never uploads or syncs them.\n" +
        "Self-hosted model — only your messages and the todos it reads are sent to the server you configured."
      );
    case "cloud":
      return (
        "Storage — your todos stay on this machine; todorepl never uploads or syncs them.\n" +
        "Cloud model — only your messages and the todos it reads are sent to the provider to reply."
      );
  }
}
