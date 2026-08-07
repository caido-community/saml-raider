export type CertificateSource = "Imported" | "Generated" | "Extracted";

export type BasicConstraints = {
  isCertificateAuthority: boolean;
  pathLength?: number;
  isCritical: boolean;
};

export type UnsupportedExtension = {
  oid: string;
  isCritical: boolean;
  valueBase64: string;
};

export type CertificateDetails = {
  version: number;
  serialNumberHex: string;
  signatureAlgorithm: string;
  issuer: string;
  subject: string;
  notBefore: string;
  notAfter: string;
  publicKeyAlgorithm: string;
  keySizeBits: number;
  modulusHex: string;
  publicExponent: number;
  signatureHex: string;
  fingerprintSha1: string;
  fingerprintSha256: string;
  basicConstraints?: BasicConstraints;
  keyUsage: string[];
  isKeyUsageCritical: boolean;
  extendedKeyUsage: string[];
  subjectAlternativeNames: string[];
  issuerAlternativeNames: string[];
  subjectKeyIdentifier?: string;
  authorityKeyIdentifier?: string;
  unsupportedExtensions: UnsupportedExtension[];
  isSelfSigned: boolean;
};

export type Certificate = {
  id: string;
  label: string;
  source: CertificateSource;
  parentId?: string;
  hasPrivateKey: boolean;
  createdAt: string;
  certificatePem: string;
  details: CertificateDetails;
};

export type ImportedCertificate = {
  certificate: Certificate;
  wasAlreadyStored: boolean;
};

export type ImportCertificatesInput = {
  encoded: string;
  label?: string;
  source: CertificateSource;
};

export type ImportPrivateKeyInput = {
  certificateId: string;
  privateKeyPem: string;
};

export type UpdateCertificateLabelInput = {
  id: string;
  label: string;
};

export type CertificateSubject = {
  commonName: string;
  organization?: string;
  organizationalUnit?: string;
  country?: string;
  state?: string;
  locality?: string;
};

export type CertificateValidity = {
  notBefore: string;
  notAfter: string;
};

export type SignatureAlgorithm = "SHA-256" | "SHA-384" | "SHA-512" | "SHA-1";

export type CreateSelfSignedInput = {
  label: string;
  privateKeyPem: string;
  subject: CertificateSubject;
  validity: CertificateValidity;
  signatureAlgorithm: SignatureAlgorithm;
  isCertificateAuthority: boolean;
};

export type CloneCertificateInput = {
  sourceId: string;
  label: string;
  privateKeyPem: string;
  signatureAlgorithm: SignatureAlgorithm;
};

export type CloneChainKey = {
  sourceId: string;
  privateKeyPem: string;
};

export type CloneChainInput = {
  sourceId: string;
  labelSuffix: string;
  keys: CloneChainKey[];
  signatureAlgorithm: SignatureAlgorithm;
};

export type CertificateBackup = {
  format: "saml-raider-certificates";
  version: number;
  certificates: Array<{
    id: string;
    label: string;
    source: CertificateSource;
    parentId?: string;
    createdAt: string;
    certificatePem: string;
    privateKeyPem?: string;
  }>;
};

export type ExportBackupInput = {
  includePrivateKeys: boolean;
};

export type SignSignedInfoInput = {
  certificateId: string;
  signedInfoBase64: string;
  signatureAlgorithm: SignatureAlgorithm;
};

export type VerifySignatureInput = {
  certificatePem: string;
  signedInfoBase64: string;
  signatureBase64: string;
  signatureAlgorithm: SignatureAlgorithm;
};
