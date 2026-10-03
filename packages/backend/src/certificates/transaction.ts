import {
  type Certificate,
  err,
  type ImportedCertificate,
  ok,
  type Result,
} from "shared";

import { linkParents } from "./chain";
import { parseCertificatePem } from "./parse";
import { buildCertificate, readMatchingKey } from "./records";
import { STORE_VERSION, type StoredCertificate } from "./schema";
import { type CertificateStore } from "./store";

const MAX_CERTIFICATES = 500;

export type Clock = () => string;

type Commit = {
  certificates: StoredCertificate[];
  keysById: Map<string, string>;
  removedKeyIds: string[];
};

export type Incoming = {
  certificatePem: string;
  label?: string;
  source: StoredCertificate["source"];
  createdAt?: string;
  privateKeyPem?: string;
};

export type Generated = {
  certificatePem: string;
  label: string;
  privateKeyPem: string;
};

export type CertificateTransaction = {
  serialise: <T>(operation: () => Promise<T>) => Promise<T>;
  listAll: () => Promise<Result<Certificate[]>>;
  commit: (change: Commit) => Promise<Result<Certificate[]>>;
  findById: (
    id: string,
  ) => Promise<Result<{ stored: StoredCertificate; all: StoredCertificate[] }>>;
  addCertificates: (
    incoming: Incoming[],
  ) => Promise<Result<ImportedCertificate[]>>;
  storeGenerated: (generated: Generated[]) => Promise<Result<Certificate[]>>;
};

const buildMutex = () => {
  let tail: Promise<unknown> = Promise.resolve();

  return <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation, operation);

    tail = result.catch(() => undefined);
    return result;
  };
};

export const buildTransaction = (
  store: CertificateStore,
  now: Clock,
): CertificateTransaction => {
  const serialise = buildMutex();

  const listAll = async (): Promise<Result<Certificate[]>> => {
    const state = await store.readState();
    if (state.kind === "Error") return state;

    const keyIds = await store.listPrivateKeyIds();
    if (keyIds.kind === "Error") return keyIds;

    const certificates: Certificate[] = [];
    for (const stored of state.value.certificates) {
      const built = buildCertificate(stored, keyIds.value);
      if (built.kind === "Error") return built;
      certificates.push(built.value);
    }

    return ok(certificates);
  };

  const rollbackKeys = async (ids: string[]): Promise<void> => {
    for (const id of ids) await store.removePrivateKey(id);
  };

  const commit = async (change: Commit): Promise<Result<Certificate[]>> => {
    if (change.certificates.length > MAX_CERTIFICATES) {
      return err(
        `The store holds at most ${MAX_CERTIFICATES} certificates. Delete some before importing more.`,
      );
    }

    const staged: string[] = [];
    for (const [id, pem] of change.keysById) {
      const written = await store.writePrivateKeyPem(id, pem);
      if (written.kind === "Error") {
        await rollbackKeys(staged);
        return written;
      }
      staged.push(id);
    }

    const written = await store.writeState({
      version: STORE_VERSION,
      certificates: linkParents(change.certificates),
    });
    if (written.kind === "Error") {
      await rollbackKeys(staged);
      return written;
    }

    for (const id of change.removedKeyIds) {
      const removed = await store.removePrivateKey(id);
      if (removed.kind === "Error") return removed;
    }

    return listAll();
  };

  const findById = async (
    id: string,
  ): Promise<
    Result<{ stored: StoredCertificate; all: StoredCertificate[] }>
  > => {
    const state = await store.readState();
    if (state.kind === "Error") return state;

    const stored = state.value.certificates.find(
      (candidate) => candidate.id === id,
    );

    return stored === undefined
      ? err("That certificate is no longer in the store.")
      : ok({ stored, all: state.value.certificates });
  };

  const addCertificates = async (
    incoming: Incoming[],
  ): Promise<Result<ImportedCertificate[]>> => {
    const state = await store.readState();
    if (state.kind === "Error") return state;

    const certificates = [...state.value.certificates];
    const keysById = new Map<string, string>();
    const imported: Array<{ id: string; wasAlreadyStored: boolean }> = [];

    for (const [index, entry] of incoming.entries()) {
      const parsed = parseCertificatePem(entry.certificatePem);

      if (parsed.kind === "UnsupportedKey") {
        return err(
          `Certificate ${index + 1} uses a key type this plugin does not support (${parsed.algorithm}).`,
        );
      }

      if (parsed.kind !== "Ok") {
        return err(
          `Certificate ${index + 1} could not be read: ${parsed.message}`,
        );
      }

      const id = parsed.details.fingerprintSha256;
      const existing = certificates.find((candidate) => candidate.id === id);

      if (existing === undefined) {
        certificates.push({
          id,
          label:
            entry.label !== undefined && entry.label !== ""
              ? entry.label
              : parsed.details.subject,
          source: entry.source,
          createdAt: entry.createdAt ?? now(),
          certificatePem: parsed.normalisedPem,
        });
      }

      imported.push({ id, wasAlreadyStored: existing !== undefined });

      if (entry.privateKeyPem !== undefined) {
        const matched = readMatchingKey(
          parsed.normalisedPem,
          entry.privateKeyPem,
        );
        if (matched.kind === "Error") return matched;
        keysById.set(id, matched.value);
      }
    }

    const saved = await commit({ certificates, keysById, removedKeyIds: [] });
    if (saved.kind === "Error") return saved;

    const byId = new Map(saved.value.map((entry) => [entry.id, entry]));

    return ok(
      imported.flatMap((entry) => {
        const certificate = byId.get(entry.id);
        return certificate === undefined
          ? []
          : [{ certificate, wasAlreadyStored: entry.wasAlreadyStored }];
      }),
    );
  };

  const storeGenerated = async (
    generated: Generated[],
  ): Promise<Result<Certificate[]>> => {
    const state = await store.readState();
    if (state.kind === "Error") return state;

    const certificates = [...state.value.certificates];
    const keysById = new Map<string, string>();
    const createdIds: string[] = [];

    for (const entry of generated) {
      const parsed = parseCertificatePem(entry.certificatePem);
      if (parsed.kind !== "Ok") {
        return err("The generated certificate could not be read back.");
      }

      const id = parsed.details.fingerprintSha256;
      const record: StoredCertificate = {
        id,
        label: entry.label,
        source: "Generated",
        createdAt: now(),
        certificatePem: parsed.normalisedPem,
      };

      const index = certificates.findIndex((stored) => stored.id === id);
      certificates[index === -1 ? certificates.length : index] = record;

      keysById.set(id, entry.privateKeyPem);
      createdIds.push(id);
    }

    const saved = await commit({ certificates, keysById, removedKeyIds: [] });
    if (saved.kind === "Error") return saved;

    const byId = new Map(saved.value.map((entry) => [entry.id, entry]));
    return ok(
      createdIds.flatMap((id) => {
        const certificate = byId.get(id);
        return certificate === undefined ? [] : [certificate];
      }),
    );
  };

  return {
    serialise,
    listAll,
    commit,
    findById,
    addCertificates,
    storeGenerated,
  };
};
