import { buildPem } from "shared";

const BLOCK = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g;

export type PemBlock = { label: string; body: string };

const readPemBlocks = (pem: string): PemBlock[] => {
  const blocks: PemBlock[] = [];

  for (const match of pem.matchAll(BLOCK)) {
    const label = match[1];
    const body = match[2];
    if (label === undefined || body === undefined) continue;
    blocks.push({ label, body: body.replace(/\s+/g, "") });
  }

  return blocks;
};

const BASE64_ONLY = /^[A-Za-z0-9+/=\s]+$/;

export const readCertificateBlocks = (input: string): PemBlock[] => {
  const blocks = readPemBlocks(input).filter(
    (block) => block.label === "CERTIFICATE",
  );
  if (blocks.length > 0) return blocks;

  const body = input.replace(/\s+/g, "");
  return body !== "" && BASE64_ONLY.test(input)
    ? [{ label: "CERTIFICATE", body }]
    : [];
};

export const readPrivateKeyPemBlock = (input: string): string | undefined => {
  const block = readPemBlocks(input).find((entry) =>
    entry.label.endsWith("PRIVATE KEY"),
  );
  if (block !== undefined) return buildPem(block.label, block.body);

  const body = input.replace(/\s+/g, "");
  return body !== "" && BASE64_ONLY.test(input)
    ? buildPem("PRIVATE KEY", body)
    : undefined;
};

export const readDerBytes = (block: PemBlock): Uint8Array =>
  new Uint8Array(Buffer.from(block.body, "base64"));
