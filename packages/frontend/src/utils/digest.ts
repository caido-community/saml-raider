import { type SignatureAlgorithm } from "shared";

import { encodeBase64 } from "./encoding";

export const buildDigest = async (
  bytes: Uint8Array,
  algorithm: SignatureAlgorithm,
): Promise<string> =>
  encodeBase64(new Uint8Array(await crypto.subtle.digest(algorithm, bytes)));
