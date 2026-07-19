# Vision

## Executive Summary

- The project is an agent-native todo system: harnesses (Claude, Codex, any MCP client) supply the
  intelligence, and this repo supplies the substrate they work against.
- The primary interface is a globally registered MCP server over the local SQLite todo store; the
  existing Stricli CLI stays as a secondary transport for humans, scripts, and backup.
- The system pushes rather than waits: a scheduled morning session re-aligns todos against
  priorities, and the MCP server makes todo state available in every project without the user
  choosing a skill to run.
- Context is recorded as an OKF (Open Knowledge Format) bundle of living concept documents, so the
  reasoning behind todos survives across sessions and harnesses.
- The project will be renamed to `todomcp` to match this identity; the rename is decided but not yet
  executed.
- App surface stays minimal: skills plus small scripts over the substrate. No web, desktop, or
  mobile UI.

## Product Direction

The user should not have to think about which skill to execute at what moment. The system works as a
push mechanism across all projects, not a pull mechanism inside one repo:

1. **Loose intake.** Unorganised input — dictation documents, pasted Granola notes, emails — is
   handed to any harness session and captured as raw todo candidates.
2. **Grilling.** A grilling session turns raw candidates into organised todos: one sharp question at
   a time, vague items clarified, and any todo whose effort estimate exceeds 120 minutes flagged
   for breakdown into smaller todos.
3. **Prioritisation.** The harness produces a prioritised list. Position in the list is the
   priority: the existing date + order fields are the ranking, and a todo's `effort` estimate is
   weighed against actual free time read from the user's calendars.
4. **Completion assistance.** The harness helps complete todos from their recorded context: first
   drafts of emails, step plans, initial documents.
5. **Velocity and nudging.** Completion velocity is derived from completion timestamps already in
   the store. As todos complete, the system gently nudges toward completing more — encouragement,
   not pressure.
6. **Morning re-alignment.** A scheduled morning session re-examines uncompleted todos from previous
   days and re-grills the list against current priorities before the day starts.

### Context recording (OKF)

The process is recorded using the
[Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md):
a directory of markdown concept documents with YAML frontmatter, cross-linked into a graph.

- Each substantial todo and each recurring theme gets one **living concept document** holding its
  context: origin (dictation, email, Granola), breakdown, grilling decisions, and priority
  rationale.
- Grilling sessions **update** these documents rather than being stored as transcripts.
- SQLite remains the state of record for status, dates, and ordering; the OKF bundle holds the why.

### Calendar awareness

Prioritisation takes available time into account through **configurable read-only calendars**,
reusing the PlanStack model: a configured list of iCal feeds (label, `https://`/`webcal://` URL,
enabled flag), validated on add. Feeds are fetched at planning time to compute free time; no
calendar data is stored, and calendars are never written to.

### Delivery shape

- **Global MCP server** — registered user-wide so every harness in every project reads and writes
  the same todo store through one protocol.
- **Scheduled morning session** — runs on a local scheduler (the data is local, so the session must
  be too) and initiates the re-alignment grilling without being asked.
- **CLI (secondary)** — the existing Stricli command surface and REPL remain for human inspection,
  scripting, and export/import; no new CLI features unless a workflow needs one.
- **Skills** — intake, grilling, prioritisation, and completion-assistance behaviors ship as skills
  installed at user level, not per project.
- **Installer** — a single setup command registers the MCP server and installs the morning-session
  scheduler into the harness the user selects (Claude, Codex, or another MCP client), so adoption
  is one command rather than manual configuration.

## Non-Goals

- No web, desktop, or mobile UI.
- No calendar writes; calendar access is read-only, at planning time only.
- No remote sync of todo data; the store and the OKF bundle stay on the local machine.
- No always-on daemon or OS-notification layer; push arrives through the scheduled session and the
  harness, not through new resident software.
