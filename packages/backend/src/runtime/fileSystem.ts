import {
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "fs/promises";
import { join } from "path";

import { readErrorMessage } from "shared";

const DIRECTORY_MODE = 0o700;

export const SECRET_FILE_MODE = 0o600;

export const PUBLIC_FILE_MODE = 0o600;

type ReadOutcome =
  | { kind: "Found"; content: string }
  | { kind: "Missing" }
  | { kind: "Failed"; message: string };

type WriteOutcome = { kind: "Written" } | { kind: "Failed"; message: string };

type ListOutcome =
  | { kind: "Listed"; names: string[] }
  | { kind: "Failed"; message: string };

export type FileSystem = {
  makeDirectory: (path: string) => Promise<WriteOutcome>;
  readTextFile: (path: string) => Promise<ReadOutcome>;
  writeTextFile: (
    path: string,
    content: string,
    mode: number,
  ) => Promise<WriteOutcome>;
  removeFile: (path: string) => Promise<WriteOutcome>;
  listFileNames: (path: string) => Promise<ListOutcome>;
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

let stagingCounter = 0;

export const buildFileSystem = (): FileSystem => ({
  makeDirectory: async (path) => {
    try {
      await mkdir(path, { recursive: true, mode: DIRECTORY_MODE });
      return { kind: "Written" };
    } catch (error) {
      return { kind: "Failed", message: readErrorMessage(error) };
    }
  },

  readTextFile: async (path) => {
    try {
      return { kind: "Found", content: await readFile(path, "utf8") };
    } catch (error) {
      return (await exists(path))
        ? { kind: "Failed", message: readErrorMessage(error) }
        : { kind: "Missing" };
    }
  },

  writeTextFile: async (path, content, mode) => {
    stagingCounter += 1;
    const staged = `${path}.${stagingCounter}.staging`;

    try {
      await writeFile(staged, content, { mode });
      await rename(staged, path);
      return { kind: "Written" };
    } catch (error) {
      await rm(staged).catch(() => undefined);
      return { kind: "Failed", message: readErrorMessage(error) };
    }
  },

  removeFile: async (path) => {
    try {
      await rm(path);
      return { kind: "Written" };
    } catch (error) {
      return (await exists(path))
        ? { kind: "Failed", message: readErrorMessage(error) }
        : { kind: "Written" };
    }
  },

  listFileNames: async (path) => {
    try {
      const entries = await readdir(path);
      return { kind: "Listed", names: entries.map((entry) => String(entry)) };
    } catch (error) {
      return (await exists(path))
        ? { kind: "Failed", message: readErrorMessage(error) }
        : { kind: "Listed", names: [] };
    }
  },
});

export const buildPath = join;
