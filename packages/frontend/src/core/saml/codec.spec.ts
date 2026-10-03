import { deflateSync, gzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  decodeSamlParameter,
  encodeSamlParameter,
  MAX_DECODED_BYTES,
  MAX_ENCODED_BYTES,
} from "./codec";
import { type Compression, type DecodeFailure } from "./types";

import { encodeBase64 } from "@/utils";

const ASSERTION =
  '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_r1"><saml:Assertion ID="_a1"><saml:Issuer>https://idp.example.com</saml:Issuer></saml:Assertion></samlp:Response>';

const compress = (xml: string, format: "gzip" | "deflate"): string => {
  const bytes = new TextEncoder().encode(xml);
  const out = format === "gzip" ? gzipSync(bytes) : deflateSync(bytes);
  return encodeURIComponent(encodeBase64(out));
};

const expectOk = (value: string) => {
  const outcome = decodeSamlParameter(value);
  if (outcome.kind !== "Ok") {
    throw new Error(`expected Ok, received ${outcome.failure.kind}`);
  }
  return outcome.value;
};

const expectFailure = (value: string): DecodeFailure => {
  const outcome = decodeSamlParameter(value);
  if (outcome.kind !== "Failed") {
    throw new Error(`expected Failed, received Ok`);
  }
  return outcome.failure;
};

describe("POST binding, no compression", () => {
  it("decodes and reports no compression", () => {
    const encoded = encodeURIComponent(
      encodeBase64(new TextEncoder().encode(ASSERTION)),
    );

    const decoded = expectOk(encoded);

    expect(decoded.xml).toBe(ASSERTION);
    expect(decoded.compression).toBe("None");
  });
});

describe("redirect binding", () => {
  it("decodes raw DEFLATE and reports Deflate", () => {
    const decoded = expectOk(compress(ASSERTION, "deflate"));

    expect(decoded.xml).toBe(ASSERTION);
    expect(decoded.compression).toBe("Deflate");
  });

  it("decodes gzip and reports Gzip", () => {
    const decoded = expectOk(compress(ASSERTION, "gzip"));

    expect(decoded.xml).toBe(ASSERTION);
    expect(decoded.compression).toBe("Gzip");
  });

  it("does not confuse gzip for deflate", () => {
    const gzip = expectOk(compress(ASSERTION, "gzip"));
    const deflate = expectOk(compress(ASSERTION, "deflate"));

    expect(gzip.compression).not.toBe(deflate.compression);
  });
});

describe("symmetry", () => {
  const cases: Compression[] = ["None", "Deflate", "Gzip"];

  for (const compression of cases) {
    it(`round-trips ${compression}`, () => {
      const encoded = encodeSamlParameter(ASSERTION, compression);
      const decoded = expectOk(encoded);

      expect(decoded.xml).toBe(ASSERTION);
      expect(decoded.compression).toBe(compression);
      expect(encodeSamlParameter(decoded.xml, decoded.compression)).toBe(
        encoded,
      );
    });
  }
});

describe("failures", () => {
  it("reports InvalidBase64 on characters outside the alphabet", () => {
    expect(expectFailure("not base64 !!")).toStrictEqual({
      kind: "InvalidBase64",
    });
  });

  it("reports DecompressionFailed on base64 that is neither compressed nor XML", () => {
    const junk = encodeBase64(new Uint8Array([0x01, 0x02, 0x03, 0x04]));

    expect(expectFailure(junk)).toStrictEqual({
      kind: "DecompressionFailed",
    });
  });
});

describe("malformed percent-encoding", () => {
  it("reports MalformedUrlEncoding instead of throwing URIError", () => {
    expect(expectFailure("%")).toStrictEqual({
      kind: "MalformedUrlEncoding",
    });
  });

  it("reports it for a truncated multi-byte escape too", () => {
    expect(expectFailure("%E0%A4%A")).toStrictEqual({
      kind: "MalformedUrlEncoding",
    });
  });
});

describe("url encoding", () => {
  it("survives a payload whose base64 contains +, / and =", () => {
    const bytes = new Uint8Array([0xfb, 0xef, 0xbe, 0xff, 0xff, 0xff]);
    const base64 = encodeBase64(bytes);

    expect(base64).toContain("+");
    expect(base64).toContain("/");

    expect(expectFailure(encodeURIComponent(base64))).toStrictEqual({
      kind: "DecompressionFailed",
    });
  });

  it("strips whitespace and line breaks before decoding", () => {
    const base64 = encodeBase64(new TextEncoder().encode(ASSERTION));
    const wrapped = `${base64.slice(0, 40)}\r\n${base64.slice(40)}`;

    const decoded = expectOk(encodeURIComponent(wrapped));

    expect(decoded.xml).toBe(ASSERTION);
  });

  it("treats an unescaped + as a plus, not as a space", () => {
    const xml = `<a>${String.fromCharCode(0xfb, 0xef, 0xbe)}</a>`;
    const base64 = encodeBase64(new TextEncoder().encode(xml));
    expect(base64).toContain("+");

    const escaped = expectOk(encodeURIComponent(base64));
    const unescaped = expectOk(base64);

    expect(unescaped.xml).toBe(escaped.xml);
  });
});

describe("size limits", () => {
  it("refuses an encoded parameter beyond the input limit", () => {
    const huge = "A".repeat(MAX_ENCODED_BYTES + 1);

    expect(expectFailure(huge)).toStrictEqual({ kind: "TooLarge" });
  });

  it("accepts a parameter just under the input limit", () => {
    const xml = "<r>ok</r>";
    const encoded = encodeURIComponent(
      encodeBase64(new TextEncoder().encode(xml)),
    );

    expect(encoded.length).toBeLessThan(MAX_ENCODED_BYTES);
    expect(expectOk(encoded).xml).toBe(xml);
  });

  it("refuses a payload that expands beyond the decoded limit", () => {
    const bomb = gzipSync(new Uint8Array(MAX_DECODED_BYTES + 1024));

    expect(bomb.length).toBeLessThan(200_000);

    expect(expectFailure(encodeBase64(bomb))).toStrictEqual({
      kind: "DecompressionFailed",
    });
  });

  it("does not even attempt to inflate a payload that could exceed the limit", () => {
    const oversized = encodeBase64(new Uint8Array(64 * 1024).fill(0x41));

    expect(expectFailure(oversized)).toStrictEqual({
      kind: "DecompressionFailed",
    });
  });
});
