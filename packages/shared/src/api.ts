import type {
  Certificate,
  CloneCertificateInput,
  CloneChainInput,
  CreateSelfSignedInput,
  ExportBackupInput,
  ImportCertificatesInput,
  ImportedCertificate,
  ImportPrivateKeyInput,
  SignSignedInfoInput,
  UpdateCertificateLabelInput,
  VerifySignatureInput,
} from "./certificates";
import type { HighlightSettings, ParameterNames } from "./preferences";
import type { Result } from "./result";

export type API = {
  listCertificates: () => Promise<Result<Certificate[]>>;
  importCertificates: (
    input: ImportCertificatesInput,
  ) => Promise<Result<ImportedCertificate[]>>;
  importPrivateKey: (
    input: ImportPrivateKeyInput,
  ) => Promise<Result<Certificate>>;
  updateCertificateLabel: (
    input: UpdateCertificateLabelInput,
  ) => Promise<Result<Certificate>>;
  deleteCertificate: (id: string) => Promise<Result<string>>;
  createSelfSignedCertificate: (
    input: CreateSelfSignedInput,
  ) => Promise<Result<Certificate>>;
  cloneCertificate: (
    input: CloneCertificateInput,
  ) => Promise<Result<Certificate>>;
  cloneCertificateChain: (
    input: CloneChainInput,
  ) => Promise<Result<Certificate[]>>;
  exportBackup: (input: ExportBackupInput) => Promise<Result<string>>;
  importBackup: (json: string) => Promise<Result<ImportedCertificate[]>>;

  readPrivateKeyPem: (id: string) => Promise<Result<string>>;
  signSignedInfo: (input: SignSignedInfoInput) => Promise<Result<string>>;
  verifySignature: (input: VerifySignatureInput) => Promise<Result<boolean>>;

  getParameterNames: () => Promise<Result<ParameterNames>>;
  setParameterNames: (input: ParameterNames) => Promise<Result<ParameterNames>>;
  getHighlightSettings: () => Promise<Result<HighlightSettings>>;
  setHighlightSettings: (
    input: HighlightSettings,
  ) => Promise<Result<HighlightSettings>>;
};
