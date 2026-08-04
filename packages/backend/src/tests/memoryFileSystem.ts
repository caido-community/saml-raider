import { type FileSystem } from "../runtime/fileSystem";

export type MemoryFileSystem = FileSystem & {
  files: Map<string, { content: string; mode: number }>;
  failing: Set<string>;
  failingWrites: Set<string>;
};

export const buildMemoryFileSystem = (): MemoryFileSystem => {
  const files = new Map<string, { content: string; mode: number }>();
  const failing = new Set<string>();
  const failingWrites = new Set<string>();

  const fails = (path: string): boolean => failing.has(path);

  return {
    files,
    failing,
    failingWrites,

    makeDirectory: (path) =>
      Promise.resolve(
        fails(path)
          ? { kind: "Failed", message: "permission denied" }
          : { kind: "Written" },
      ),

    readTextFile: (path) => {
      if (fails(path)) {
        return Promise.resolve({
          kind: "Failed" as const,
          message: "permission denied",
        });
      }

      const entry = files.get(path);
      return Promise.resolve(
        entry === undefined
          ? { kind: "Missing" as const }
          : { kind: "Found" as const, content: entry.content },
      );
    },

    writeTextFile: (path, content, mode) => {
      if (fails(path) || failingWrites.has(path)) {
        return Promise.resolve({
          kind: "Failed" as const,
          message: "disk full",
        });
      }

      files.set(path, { content, mode });
      return Promise.resolve({ kind: "Written" as const });
    },

    removeFile: (path) => {
      if (fails(path)) {
        return Promise.resolve({
          kind: "Failed" as const,
          message: "permission denied",
        });
      }

      files.delete(path);
      return Promise.resolve({ kind: "Written" as const });
    },

    listFileNames: (path) => {
      if (fails(path)) {
        return Promise.resolve({
          kind: "Failed" as const,
          message: "permission denied",
        });
      }

      const prefix = `${path}/`;
      return Promise.resolve({
        kind: "Listed" as const,
        names: [...files.keys()]
          .filter((name) => name.startsWith(prefix))
          .map((name) => name.slice(prefix.length)),
      });
    },
  };
};
