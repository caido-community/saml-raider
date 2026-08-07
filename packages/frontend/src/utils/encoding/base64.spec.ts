import { describe, expect, it } from "vitest";

import { decodeBase64, encodeBase64 } from "./base64";

import { isAbsent } from "@/utils";

describe("encodeBase64", () => {
  it("encodes ascii", () => {
    expect(encodeBase64(new TextEncoder().encode("Hello"))).toBe("SGVsbG8=");
  });

  it("encodes empty input", () => {
    expect(encodeBase64(new Uint8Array())).toBe("");
  });

  it("encodes bytes above 0x7F without corrupting them", () => {
    const bytes = new Uint8Array([0x00, 0x7f, 0x80, 0xc3, 0xff]);
    expect(decodeBase64(encodeBase64(bytes))).toStrictEqual(bytes);
  });
});

describe("decodeBase64", () => {
  it("decodes ascii", () => {
    const decoded = decodeBase64("SGVsbG8=");
    expect(
      isAbsent(decoded) ? undefined : new TextDecoder().decode(decoded),
    ).toBe("Hello");
  });

  it("decodes empty input", () => {
    expect(decodeBase64("")).toStrictEqual(new Uint8Array());
  });

  it("returns undefined on characters outside the alphabet", () => {
    expect(decodeBase64("not base64 !!")).toBeUndefined();
  });

  it("tolerates missing padding, which some SAML producers omit", () => {
    const padded = decodeBase64("SGVsbG8=");
    const unpadded = decodeBase64("SGVsbG8");

    expect(unpadded).toStrictEqual(padded);
  });

  it("returns undefined on a length that cannot be base64", () => {
    expect(decodeBase64("SGVsbG8==")).toBeUndefined();
  });
});

describe("round trip", () => {
  it("survives every byte value", () => {
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i++) all[i] = i;

    expect(decodeBase64(encodeBase64(all))).toStrictEqual(all);
  });

  it("survives a DER-shaped prefix", () => {
    const der = new Uint8Array([
      0x30, 0x82, 0x03, 0xa1, 0x30, 0x82, 0x02, 0x89,
    ]);
    expect(decodeBase64(encodeBase64(der))).toStrictEqual(der);
  });
});
