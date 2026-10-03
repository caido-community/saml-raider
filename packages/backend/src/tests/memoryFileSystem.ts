import { type FileSystem } from "../runtime/fileSystem";

export type MemoryFileSystem = FileSystem & {
  files: Map<string, { content: string; mode: number }>;
  failing: Set<string>;
  failingWrites: Set<string>;
  reads: { count: number };
};

export const buildMemoryFileSystem = (): MemoryFileSystem => {
  const files = new Map<string, { content: string; mode: number }>();
  const failing = new Set<string>();
  const failingWrites = new Set<string>();
  const reads = { count: 0 };

  const fails = (path: string): boolean => failing.has(path);

  return {
    files,
    failing,
    failingWrites,
    reads,

    makeDirectory: (path) =>
      Promise.resolve(
        fails(path)
          ? { kind: "Failed", message: "permission denied" }
          : { kind: "Written" },
      ),

    readTextFile: (path) => {
      reads.count += 1;
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
