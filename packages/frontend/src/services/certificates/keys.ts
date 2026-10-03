import { buildPem } from "shared";

import { encodeBase64 } from "@/utils";

const KEY_SIZE_BITS = 2048;

const PUBLIC_EXPONENT = new Uint8Array([1, 0, 1]);

export const generateRsaPrivateKeyPem = async (): Promise<string> => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: KEY_SIZE_BITS,
      publicExponent: PUBLIC_EXPONENT,
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );

  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);

  return buildPem("PRIVATE KEY", encodeBase64(new Uint8Array(pkcs8)));
};
