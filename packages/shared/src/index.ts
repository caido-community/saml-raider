import type { DefinePluginPackageSpec } from "@caido/sdk-shared";

import type { API } from "./api";
import type { Events } from "./events";

export type Spec = DefinePluginPackageSpec<{
  manifestId: "saml-raider";
  api: API;
  events: Events;
}>;

export type { API } from "./api";
export type {
  BasicConstraints,
  Certificate,
  CertificateBackup,
  CertificateDetails,
  CertificateSource,
  CertificateSubject,
  CertificateValidity,
  CloneCertificateInput,
  CloneChainInput,
  CloneChainKey,
  CreateSelfSignedInput,
  ExportBackupInput,
  ImportCertificatesInput,
  ImportedCertificate,
  ImportPrivateKeyInput,
  SignatureAlgorithm,
  SignSignedInfoInput,
  VerifySignatureInput,
  UnsupportedExtension,
  UpdateCertificateLabelInput,
} from "./certificates";
export type { Events } from "./events";
export { DEFAULT_PARAMETER_NAMES, type ParameterNames } from "./preferences";
export { readErrorMessage } from "./errors";
export { buildPem } from "./pem";
export { err, ok, type Result } from "./result";
