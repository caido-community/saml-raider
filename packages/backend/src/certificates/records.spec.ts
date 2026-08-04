import { describe, expect, it } from "vitest";

import { forge } from "../runtime/forge";
import {
  LEAF_CERTIFICATE_PEM,
  LEAF_KEY_PEM,
  ROOT_KEY_PEM,
} from "../tests/fixtures";

import { readMatchingKey } from "./records";

describe("matching a private key to its certificate", () => {
  it("accepts the key that belongs to it", () => {
    const result = readMatchingKey(LEAF_CERTIFICATE_PEM, LEAF_KEY_PEM);

    expect(result.kind).toBe("Ok");
  });

  it("refuses a key with a different modulus", () => {
    const result = readMatchingKey(LEAF_CERTIFICATE_PEM, ROOT_KEY_PEM);

    expect(result.kind).toBe("Error");
    expect(result.kind === "Error" && result.error).toContain("moduli");
  });

  it("refuses a key that shares the modulus but not the exponent", () => {
    const original = forge.pki.privateKeyFromPem(LEAF_KEY_PEM);
    const mismatched = forge.pki.setRsaPrivateKey(
      original.n,
      forge.jsbn.BigInteger.ONE.shiftLeft(16).add(
        forge.jsbn.BigInteger.ONE.shiftLeft(1),
      ),
      original.d,
      original.p,
      original.q,
      original.dP,
      original.dQ,
      original.qInv,
    );

    const result = readMatchingKey(
      LEAF_CERTIFICATE_PEM,
      forge.pki.privateKeyToPem(mismatched),
    );

    expect(result.kind).toBe("Error");
    expect(result.kind === "Error" && result.error).toContain("exponents");
  });

  it("refuses input that is not a key at all", () => {
    const result = readMatchingKey(LEAF_CERTIFICATE_PEM, "not a key");

    expect(result.kind).toBe("Error");
  });
});
