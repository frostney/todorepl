import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

const replCommands = new Map<string, () => "continue" | "exit">([
  ["exit", () => "exit"],
  ["quit", () => "exit"],
  [
    "help",
    () => {
      console.log("Planned commands: add, list, done, edit, move, delete, categories.");
      return "continue";
    },
  ],
]);

export async function startRepl() {
  console.log("todorepl");
  console.log('Type "help" for commands or "exit" to leave.');

  const rl = createInterface({ input, output, prompt: "todo> " });
  rl.prompt();

  for await (const line of rl) {
    if (handleReplCommand(line.trim()) === "exit") break;
    rl.prompt();
  }

  rl.close();
}

function handleReplCommand(command: string): "continue" | "exit" {
  const action = replCommands.get(command);
  if (action) return action();
  return handleUnknownCommand(command);
}

function handleUnknownCommand(command: string): "continue" {
  if (command.length > 0) console.log(`Unknown command: ${command}`);
  return "continue";
}
