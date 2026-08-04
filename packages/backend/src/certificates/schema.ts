import { z } from "zod";

export const STORE_VERSION = 1;

export const MAX_BACKUP_CHARACTERS = 16 * 1024 * 1024;

export const identifierSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "expected a SHA-256 id");

const label = z.string().trim().min(1).max(200);

const certificatePem = z
  .string()
  .max(1024 * 1024)
  .includes("-----BEGIN CERTIFICATE-----");

const privateKeyPem = z
  .string()
  .max(1024 * 1024)
  .regex(
    /-----BEGIN (RSA )?PRIVATE KEY-----/,
    "expected a PEM private key block",
  );

const source = z.enum(["Imported", "Generated", "Extracted"]);

const signatureAlgorithm = z.enum(["SHA-256", "SHA-384", "SHA-512", "SHA-1"]);

const storedCertificateSchema = z.object({
  id: identifierSchema,
  label,
  source,
  parentId: identifierSchema.optional(),
  createdAt: z.iso.datetime(),
  certificatePem,
});

export const storedStateSchema = z.object({
  version: z.literal(STORE_VERSION),
  certificates: z.array(storedCertificateSchema),
});

export type StoredCertificate = z.infer<typeof storedCertificateSchema>;

export type StoredState = z.infer<typeof storedStateSchema>;

export const importCertificatesSchema = z.object({
  encoded: z.string().max(4 * 1024 * 1024),
  label: label.optional(),
  source,
});

export const importPrivateKeySchema = z.object({
  certificateId: identifierSchema,
  privateKeyPem,
});

export const updateLabelSchema = z.object({ id: identifierSchema, label });

const subject = z.object({
  commonName: z.string().trim().min(1).max(64),
  organization: z.string().trim().max(64).optional(),
  organizationalUnit: z.string().trim().max(64).optional(),
  country: z.string().trim().length(2).optional(),
  state: z.string().trim().max(128).optional(),
  locality: z.string().trim().max(128).optional(),
});

const validity = z
  .object({ notBefore: z.iso.datetime(), notAfter: z.iso.datetime() })
  .refine(
    (value) => Date.parse(value.notAfter) > Date.parse(value.notBefore),
    "notAfter must be later than notBefore",
  );

export const createSelfSignedSchema = z.object({
  label,
  privateKeyPem,
  subject,
  validity,
  signatureAlgorithm,
  isCertificateAuthority: z.boolean(),
});

export const cloneCertificateSchema = z.object({
  sourceId: identifierSchema,
  label,
  privateKeyPem,
  signatureAlgorithm,
});

export const cloneChainSchema = z.object({
  sourceId: identifierSchema,

  labelSuffix: z.string().max(64),
  keys: z
    .array(z.object({ sourceId: identifierSchema, privateKeyPem }))
    .min(1)
    .max(16),
  signatureAlgorithm,
});

export const exportBackupSchema = z.object({ includePrivateKeys: z.boolean() });

export const backupSchema = z.object({
  format: z.literal("saml-raider-certificates"),
  version: z.literal(STORE_VERSION),
  certificates: z.array(
    z.object({
      id: identifierSchema,
      label,
      source,
      parentId: identifierSchema.optional(),
      createdAt: z.iso.datetime(),
      certificatePem,
      privateKeyPem: privateKeyPem.optional(),
    }),
  ),
});

export const readIssue = (error: z.ZodError): string =>
  error.issues[0]?.message ?? "the request was rejected";
