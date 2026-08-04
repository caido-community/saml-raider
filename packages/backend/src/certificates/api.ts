import {
  buildPem,
  type Certificate,
  type CertificateBackup,
  err,
  type ExportBackupInput,
  type ImportCertificatesInput,
  type ImportedCertificate,
  type ImportPrivateKeyInput,
  ok,
  type Result,
  type UpdateCertificateLabelInput,
} from "shared";

import { buildGenerateApi } from "./generateApi";
import { readCertificateBlocks, readPrivateKeyPemBlock } from "./pem";
import { readMatchingKey } from "./records";
import {
  backupSchema,
  exportBackupSchema,
  identifierSchema,
  importCertificatesSchema,
  importPrivateKeySchema,
  MAX_BACKUP_CHARACTERS,
  readIssue,
  STORE_VERSION,
  type StoredCertificate,
  updateLabelSchema,
} from "./schema";
import { type CertificateStore } from "./store";
import { buildTransaction, type Clock, type Incoming } from "./transaction";

const readCertificateInputs = (
  encoded: string,
  label: string | undefined,
  source: StoredCertificate["source"],
): Result<Incoming[]> => {
  const blocks = readCertificateBlocks(encoded);
  if (blocks.length === 0) {
    return err("No certificate was found in that input.");
  }

  return ok(
    blocks.map((block) => ({
      certificatePem: buildPem("CERTIFICATE", block.body),
      label: blocks.length === 1 ? label : undefined,
      source,
    })),
  );
};

export const buildCertificateApi = (store: CertificateStore, now: Clock) => {
  const transaction = buildTransaction(store, now);
  const { serialise, listAll, commit, findById, addCertificates } = transaction;

  return {
    ...buildGenerateApi(store, transaction),

    listCertificates: listAll,

    importCertificates: (
      input: ImportCertificatesInput,
    ): Promise<Result<ImportedCertificate[]>> =>
      serialise(async () => {
        const parsed = importCertificatesSchema.safeParse(input);
        if (!parsed.success) return err(readIssue(parsed.error));

        const incoming = readCertificateInputs(
          parsed.data.encoded,
          parsed.data.label,
          parsed.data.source,
        );

        return incoming.kind === "Error"
          ? incoming
          : addCertificates(incoming.value);
      }),

    importPrivateKey: (
      input: ImportPrivateKeyInput,
    ): Promise<Result<Certificate>> =>
      serialise(async () => {
        const armoured = readPrivateKeyPemBlock(input.privateKeyPem ?? "");
        if (armoured === undefined) {
          return err("That file is neither a PEM nor a DER private key.");
        }

        const parsed = importPrivateKeySchema.safeParse({
          ...input,
          privateKeyPem: armoured,
        });
        if (!parsed.success) return err(readIssue(parsed.error));

        const found = await findById(parsed.data.certificateId);
        if (found.kind === "Error") return found;

        const matched = readMatchingKey(
          found.value.stored.certificatePem,
          parsed.data.privateKeyPem,
        );
        if (matched.kind === "Error") return matched;

        const saved = await commit({
          certificates: found.value.all,
          keysById: new Map([[parsed.data.certificateId, matched.value]]),
          removedKeyIds: [],
        });
        if (saved.kind === "Error") return saved;

        const certificate = saved.value.find(
          (entry) => entry.id === parsed.data.certificateId,
        );
        return certificate === undefined
          ? err("That certificate is no longer in the store.")
          : ok(certificate);
      }),

    updateCertificateLabel: (
      input: UpdateCertificateLabelInput,
    ): Promise<Result<Certificate>> =>
      serialise(async () => {
        const parsed = updateLabelSchema.safeParse(input);
        if (!parsed.success) return err(readIssue(parsed.error));

        const found = await findById(parsed.data.id);
        if (found.kind === "Error") return found;

        const saved = await commit({
          certificates: found.value.all.map((entry) =>
            entry.id === parsed.data.id
              ? { ...entry, label: parsed.data.label }
              : entry,
          ),
          keysById: new Map(),
          removedKeyIds: [],
        });
        if (saved.kind === "Error") return saved;

        const certificate = saved.value.find(
          (entry) => entry.id === parsed.data.id,
        );
        return certificate === undefined
          ? err("That certificate is no longer in the store.")
          : ok(certificate);
      }),

    deleteCertificate: (id: string): Promise<Result<string>> =>
      serialise(async () => {
        const parsed = identifierSchema.safeParse(id);
        if (!parsed.success) return err(readIssue(parsed.error));

        const found = await findById(parsed.data);
        if (found.kind === "Error") return found;

        const saved = await commit({
          certificates: found.value.all.filter(
            (entry) => entry.id !== parsed.data,
          ),
          keysById: new Map(),
          removedKeyIds: [parsed.data],
        });

        return saved.kind === "Error" ? saved : ok(parsed.data);
      }),

    exportBackup: async (input: ExportBackupInput): Promise<Result<string>> => {
      const parsed = exportBackupSchema.safeParse(input);
      if (!parsed.success) return err(readIssue(parsed.error));

      const state = await store.readState();
      if (state.kind === "Error") return state;

      const certificates: CertificateBackup["certificates"] = [];
      for (const entry of state.value.certificates) {
        if (!parsed.data.includePrivateKeys) {
          certificates.push({ ...entry, privateKeyPem: undefined });
          continue;
        }

        const key = await store.readPrivateKeyPem(entry.id);
        if (key.kind === "Error") return key;
        certificates.push({ ...entry, privateKeyPem: key.value });
      }

      const backup: CertificateBackup = {
        format: "saml-raider-certificates",
        version: STORE_VERSION,
        certificates,
      };

      return ok(`${JSON.stringify(backup, undefined, 2)}\n`);
    },

    importBackup: (json: string): Promise<Result<ImportedCertificate[]>> =>
      serialise(async () => {
        if (typeof json !== "string" || json.length > MAX_BACKUP_CHARACTERS) {
          return err(
            `A backup file may be at most ${Math.floor(MAX_BACKUP_CHARACTERS / (1024 * 1024))} MB.`,
          );
        }

        const raw = (() => {
          try {
            return JSON.parse(json) as unknown;
          } catch {
            return undefined;
          }
        })();

        if (raw === undefined) return err("That file is not valid JSON.");

        const parsed = backupSchema.safeParse(raw);
        if (!parsed.success) {
          return err(
            `That file is not a certificate backup: ${readIssue(parsed.error)}`,
          );
        }

        return addCertificates(
          parsed.data.certificates.map((entry) => ({
            certificatePem: entry.certificatePem,
            label: entry.label,
            source: entry.source,
            createdAt: entry.createdAt,
            privateKeyPem: entry.privateKeyPem,
          })),
        );
      }),

    readPrivateKeyPem: async (id: string): Promise<Result<string>> => {
      const parsed = identifierSchema.safeParse(id);
      if (!parsed.success) return err(readIssue(parsed.error));

      const pem = await store.readPrivateKeyPem(parsed.data);
      if (pem.kind === "Error") return pem;

      return pem.value === undefined
        ? err("No private key is stored for that certificate.")
        : ok(pem.value);
    },
  };
};
