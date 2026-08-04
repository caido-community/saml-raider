import {
  type Certificate,
  type CloneCertificateInput,
  type CloneChainInput,
  type CreateSelfSignedInput,
  err,
  ok,
  type Result,
} from "shared";

import { cloneCertificate, createSelfSignedCertificate } from "./generate";
import {
  cloneCertificateSchema,
  cloneChainSchema,
  createSelfSignedSchema,
  readIssue,
  type StoredCertificate,
} from "./schema";
import { type CertificateStore } from "./store";
import { type CertificateTransaction, type Generated } from "./transaction";

export const buildGenerateApi = (
  store: CertificateStore,
  transaction: CertificateTransaction,
) => ({
  createSelfSignedCertificate: (
    input: CreateSelfSignedInput,
  ): Promise<Result<Certificate>> =>
    transaction.serialise(async () => {
      const parsed = createSelfSignedSchema.safeParse(input);
      if (!parsed.success) return err(readIssue(parsed.error));

      const generated = createSelfSignedCertificate(parsed.data);
      if (generated.kind === "Failed") {
        return err(
          `The certificate could not be created: ${generated.failure.message}`,
        );
      }

      const saved = await transaction.storeGenerated([
        {
          certificatePem: generated.certificatePem,
          label: parsed.data.label,
          privateKeyPem: parsed.data.privateKeyPem,
        },
      ]);
      if (saved.kind === "Error") return saved;

      const created = saved.value[0];
      return created === undefined
        ? err("The generated certificate was not stored.")
        : ok(created);
    }),

  cloneCertificate: (
    input: CloneCertificateInput,
  ): Promise<Result<Certificate>> =>
    transaction.serialise(async () => {
      const parsed = cloneCertificateSchema.safeParse(input);
      if (!parsed.success) return err(readIssue(parsed.error));

      const found = await transaction.findById(parsed.data.sourceId);
      if (found.kind === "Error") return found;

      const generated = cloneCertificate({
        sourceCertificatePem: found.value.stored.certificatePem,
        privateKeyPem: parsed.data.privateKeyPem,
        signatureAlgorithm: parsed.data.signatureAlgorithm,
      });

      if (generated.kind === "Failed") {
        return err(
          `The certificate could not be cloned: ${generated.failure.message}`,
        );
      }

      const saved = await transaction.storeGenerated([
        {
          certificatePem: generated.certificatePem,
          label: parsed.data.label,
          privateKeyPem: parsed.data.privateKeyPem,
        },
      ]);
      if (saved.kind === "Error") return saved;

      const created = saved.value[0];
      return created === undefined
        ? err("The cloned certificate was not stored.")
        : ok(created);
    }),

  cloneCertificateChain: (
    input: CloneChainInput,
  ): Promise<Result<Certificate[]>> =>
    transaction.serialise(async () => {
      const parsed = cloneChainSchema.safeParse(input);
      if (!parsed.success) return err(readIssue(parsed.error));

      const state = await store.readState();
      if (state.kind === "Error") return state;

      const byId = new Map(
        state.value.certificates.map((entry) => [entry.id, entry]),
      );

      const chain: StoredCertificate[] = [];
      const visited = new Set<string>();
      let cursor: string | undefined = parsed.data.sourceId;

      while (cursor !== undefined && !visited.has(cursor)) {
        visited.add(cursor);
        const entry: StoredCertificate | undefined = byId.get(cursor);
        if (entry === undefined) break;
        chain.push(entry);
        cursor = entry.parentId;
      }

      if (chain.length === 0) {
        return err("That certificate is no longer in the store.");
      }

      const keys = new Map(
        parsed.data.keys.map((key) => [key.sourceId, key.privateKeyPem]),
      );

      const missing = chain.find((entry) => !keys.has(entry.id));
      if (missing !== undefined) {
        return err(
          `A new private key was not supplied for "${missing.label}", so the chain cannot be cloned.`,
        );
      }

      const generated: Generated[] = [];
      let issuer: { certificatePem: string; privateKeyPem: string } | undefined;

      for (const entry of [...chain].reverse()) {
        const privateKeyPem = keys.get(entry.id) ?? "";
        const clone = cloneCertificate({
          sourceCertificatePem: entry.certificatePem,
          privateKeyPem,
          signatureAlgorithm: parsed.data.signatureAlgorithm,
          issuer,
        });

        if (clone.kind === "Failed") {
          return err(
            `"${entry.label}" could not be cloned: ${clone.failure.message}`,
          );
        }

        generated.push({
          certificatePem: clone.certificatePem,
          label: `${entry.label}${parsed.data.labelSuffix}`,
          privateKeyPem,
        });
        issuer = { certificatePem: clone.certificatePem, privateKeyPem };
      }

      return transaction.storeGenerated(generated);
    }),
});
