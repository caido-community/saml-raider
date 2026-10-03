import { err, ok, type Result } from "shared";

import {
  buildPath,
  type FileSystem,
  PUBLIC_FILE_MODE,
  SECRET_FILE_MODE,
} from "../runtime/fileSystem";

import { STORE_VERSION, type StoredState, storedStateSchema } from "./schema";

const STATE_FILE = "certificates.json";

const KEY_DIRECTORY = "keys";

const EMPTY_STATE: StoredState = { version: STORE_VERSION, certificates: [] };

export type CertificateStore = {
  readState: () => Promise<Result<StoredState>>;
  writeState: (state: StoredState) => Promise<Result<StoredState>>;
  readPrivateKeyPem: (id: string) => Promise<Result<string | undefined>>;
  writePrivateKeyPem: (id: string, pem: string) => Promise<Result<string>>;
  removePrivateKey: (id: string) => Promise<Result<string>>;
  listPrivateKeyIds: () => Promise<Result<Set<string>>>;
};

const readVersion = (raw: unknown): number | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined;
  const version = (raw as { version?: unknown }).version;
  return typeof version === "number" ? version : undefined;
};

const migrateState = (raw: unknown): Result<StoredState> => {
  const parsed = storedStateSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);

  const version = readVersion(raw);
  if (version !== undefined && version > STORE_VERSION) {
    return err(
      `The stored certificates were written by a newer version of this plugin (format ${version}, this build understands ${STORE_VERSION}). Update the plugin rather than letting it rewrite the file.`,
    );
  }

  return err(
    `The stored certificates could not be read: ${parsed.error.issues[0]?.message ?? "unrecognised format"}. The file was left unchanged.`,
  );
};

export const buildCertificateStore = (
  fileSystem: FileSystem,
  root: string,
): CertificateStore => {
  const statePath = buildPath(root, STATE_FILE);
  const keyDirectory = buildPath(root, KEY_DIRECTORY);
  const keyPath = (id: string) => buildPath(keyDirectory, `${id}.pem`);

  const listKeyIds = async (): Promise<Result<Set<string>>> => {
    const listed = await fileSystem.listFileNames(keyDirectory);
    if (listed.kind === "Failed") {
      return err(
        `The stored private keys could not be listed: ${listed.message}`,
      );
    }

    return ok(
      new Set(
        listed.names
          .filter((name) => name.endsWith(".pem"))
          .map((name) => name.slice(0, -".pem".length)),
      ),
    );
  };

  const removeOrphanedKeys = async (state: StoredState): Promise<void> => {
    const keyIds = await listKeyIds();
    if (keyIds.kind === "Error") return;

    const known = new Set(state.certificates.map((entry) => entry.id));
    for (const id of keyIds.value) {
      if (!known.has(id)) await fileSystem.removeFile(keyPath(id));
    }
  };

  return {
    readState: async () => {
      const outcome = await fileSystem.readTextFile(statePath);

      if (outcome.kind === "Missing") return ok(EMPTY_STATE);
      if (outcome.kind === "Failed") {
        return err(
          `The stored certificates could not be read: ${outcome.message}. Nothing was changed.`,
        );
      }

      try {
        return migrateState(JSON.parse(outcome.content));
      } catch {
        return err(
          "The stored certificates could not be read: the file is not valid JSON. It was left unchanged.",
        );
      }
    },

    writeState: async (state) => {
      const directory = await fileSystem.makeDirectory(root);
      if (directory.kind === "Failed") {
        return err(
          `The plugin data directory could not be created: ${directory.message}`,
        );
      }

      const written = await fileSystem.writeTextFile(
        statePath,
        `${JSON.stringify(state, undefined, 2)}\n`,
        PUBLIC_FILE_MODE,
      );

      if (written.kind === "Failed") {
        return err(`The certificates could not be saved: ${written.message}`);
      }

      await removeOrphanedKeys(state);
      return ok(state);
    },

    readPrivateKeyPem: async (id) => {
      const outcome = await fileSystem.readTextFile(keyPath(id));

      if (outcome.kind === "Missing") return ok(undefined);
      if (outcome.kind === "Failed") {
        return err(
          `The stored private key could not be read: ${outcome.message}`,
        );
      }

      return ok(outcome.content);
    },

    writePrivateKeyPem: async (id, pem) => {
      const directory = await fileSystem.makeDirectory(keyDirectory);
      if (directory.kind === "Failed") {
        return err(
          `The key directory could not be created: ${directory.message}`,
        );
      }

      const written = await fileSystem.writeTextFile(
        keyPath(id),
        pem,
        SECRET_FILE_MODE,
      );

      return written.kind === "Failed"
        ? err(`The private key could not be saved: ${written.message}`)
        : ok(id);
    },

    removePrivateKey: async (id) => {
      const removed = await fileSystem.removeFile(keyPath(id));
      return removed.kind === "Failed"
        ? err(`The private key could not be deleted: ${removed.message}`)
        : ok(id);
    },

    listPrivateKeyIds: listKeyIds,
  };
};
