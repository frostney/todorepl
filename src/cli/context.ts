import type { CommandContext, StricliProcess } from "@stricli/core";
import { type Clock, systemClock } from "../app/clock";
import type { TodoRepository } from "../storage/repository";
import { createSqliteRepository } from "../storage/sqlite-store";

export type StoreOpener = (dataPath?: string) => TodoRepository;

export interface AppContext extends CommandContext {
  readonly process: StricliProcess;
  readonly openStore: StoreOpener;
  readonly clock: Clock;
}

export type AppContextOptions = {
  process?: StricliProcess;
  openStore?: StoreOpener;
  clock?: Clock;
};

export function createAppContext(options: AppContextOptions = {}): AppContext {
  return {
    process: options.process ?? systemProcess(),
    openStore: options.openStore ?? defaultStoreOpener,
    clock: options.clock ?? systemClock,
  };
}

const defaultStoreOpener: StoreOpener = (dataPath) =>
  createSqliteRepository(dataPath !== undefined ? { path: dataPath } : {});

function systemProcess(): StricliProcess {
  return {
    stdout: { write: (text: string): void => void process.stdout.write(text) },
    stderr: { write: (text: string): void => void process.stderr.write(text) },
  };
}
