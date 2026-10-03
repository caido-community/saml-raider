import {
  type Certificate,
  type CreateSelfSignedInput,
  err,
  type ImportedCertificate,
  type Result,
  type SignatureAlgorithm,
} from "shared";

import { generateRsaPrivateKeyPem } from "./keys";

import { type SignSignedInfo, type VerifySignedInfo } from "@/core";
import { callBackend } from "@/services/call";
import { type FrontendSDK } from "@/types";
import { isAbsent, type Maybe } from "@/utils";

export type SelfSignedRequest = Omit<CreateSelfSignedInput, "privateKeyPem">;

export type CertificateService = {
  list: () => Promise<Result<Certificate[]>>;
  importCertificates: (
    encoded: string,
    label?: string,
  ) => Promise<Result<ImportedCertificate[]>>;
  importExtractedCertificate: (
    encoded: string,
    label?: string,
  ) => Promise<Result<ImportedCertificate[]>>;
  importPrivateKey: (
    certificateId: string,
    privateKeyPem: string,
  ) => Promise<Result<Certificate>>;
  rename: (id: string, label: string) => Promise<Result<Certificate>>;
  remove: (id: string) => Promise<Result<string>>;
  createSelfSigned: (input: SelfSignedRequest) => Promise<Result<Certificate>>;
  clone: (
    sourceId: string,
    label: string,
    signatureAlgorithm: SignatureAlgorithm,
  ) => Promise<Result<Certificate>>;
  cloneChain: (
    certificates: Certificate[],
    sourceId: string,
    signatureAlgorithm: SignatureAlgorithm,
  ) => Promise<Result<Certificate[]>>;
  exportBackup: (includePrivateKeys: boolean) => Promise<Result<string>>;
  importBackup: (json: string) => Promise<Result<ImportedCertificate[]>>;
  readPrivateKeyPem: (id: string) => Promise<Result<string>>;
  signSignedInfo: SignSignedInfo;
  verifySignature: VerifySignedInfo;
};

export const buildCertificateService = (
  sdk: FrontendSDK,
): CertificateService => {
  const collectChainKeys = async (
    certificates: Certificate[],
    sourceId: string,
  ): Promise<Array<{ sourceId: string; privateKeyPem: string }>> => {
    const byId = new Map(certificates.map((entry) => [entry.id, entry]));
    const keys: Array<{ sourceId: string; privateKeyPem: string }> = [];

    const visited = new Set<string>();
    let cursor: Maybe<string> = sourceId;
    while (cursor !== undefined && !visited.has(cursor)) {
      visited.add(cursor);
      const entry: Maybe<Certificate> = byId.get(cursor);
      if (isAbsent(entry)) break;
      keys.push({
        sourceId: entry.id,
        privateKeyPem: await generateRsaPrivateKeyPem(),
      });
      cursor = entry.parentId;
    }

    return keys;
  };

  return {
    list: () => callBackend(() => sdk.backend.listCertificates()),

    importCertificates: (encoded: string, label?: string) =>
      callBackend<ImportedCertificate[]>(() =>
        sdk.backend.importCertificates({ encoded, label, source: "Imported" }),
      ),

    importExtractedCertificate: (encoded: string, label?: string) =>
      callBackend<ImportedCertificate[]>(() =>
        sdk.backend.importCertificates({ encoded, label, source: "Extracted" }),
      ),

    importPrivateKey: (certificateId: string, privateKeyPem: string) =>
      callBackend<Certificate>(() =>
        sdk.backend.importPrivateKey({ certificateId, privateKeyPem }),
      ),

    rename: (id: string, label: string) =>
      callBackend<Certificate>(() =>
        sdk.backend.updateCertificateLabel({ id, label }),
      ),

    remove: (id: string) =>
      callBackend<string>(() => sdk.backend.deleteCertificate(id)),

    createSelfSigned: (input: SelfSignedRequest) =>
      callBackend<Certificate>(async () => {
        const privateKeyPem = await generateRsaPrivateKeyPem();
        return sdk.backend.createSelfSignedCertificate({
          ...input,
          privateKeyPem,
        });
      }),

    clone: async (
      sourceId: string,
      label: string,
      signatureAlgorithm: SignatureAlgorithm,
    ) =>
      callBackend<Certificate>(async () => {
        const privateKeyPem = await generateRsaPrivateKeyPem();
        return sdk.backend.cloneCertificate({
          sourceId,
          label,
          privateKeyPem,
          signatureAlgorithm,
        });
      }),

    cloneChain: async (
      certificates: Certificate[],
      sourceId: string,
      signatureAlgorithm: SignatureAlgorithm,
    ) =>
      callBackend<Certificate[]>(async () => {
        const keys = await collectChainKeys(certificates, sourceId);
        if (keys.length === 0) {
          return err<Certificate[]>("That certificate is no longer listed.");
        }
        return sdk.backend.cloneCertificateChain({
          sourceId,
          labelSuffix: " (clone)",
          keys,
          signatureAlgorithm,
        });
      }),

    exportBackup: (includePrivateKeys: boolean) =>
      callBackend<string>(() =>
        sdk.backend.exportBackup({ includePrivateKeys }),
      ),

    importBackup: (json: string) =>
      callBackend<ImportedCertificate[]>(() => sdk.backend.importBackup(json)),

    readPrivateKeyPem: (id: string) =>
      callBackend<string>(() => sdk.backend.readPrivateKeyPem(id)),

    signSignedInfo: (input) =>
      callBackend<string>(() => sdk.backend.signSignedInfo(input)),

    verifySignature: (input) =>
      callBackend<boolean>(() => sdk.backend.verifySignature(input)),
  };
};

let shared: Maybe<CertificateService>;

export const setCertificateService = (service: CertificateService) => {
  shared = service;
};

export const readCertificateService = (): Maybe<CertificateService> => shared;
