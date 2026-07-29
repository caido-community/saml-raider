import { describe, expect, it } from "vitest";

import { decodeSamlParameter, encodeSamlParameter } from "./codec";

import { type Compression, type DecodeFailure } from "@/types";
import { encodeBase64 } from "@/utils";

const ASSERTION =
  '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_r1"><saml:Assertion ID="_a1"><saml:Issuer>https://idp.example.com</saml:Issuer></saml:Assertion></samlp:Response>';

const compress = async (
  xml: string,
  format: CompressionFormat,
): Promise<string> => {
  const stream = new Blob([new TextEncoder().encode(xml) as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream(format));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return encodeURIComponent(encodeBase64(bytes));
};

const expectOk = async (value: string) => {
  const outcome = await decodeSamlParameter(value);
  if (outcome.kind !== "Ok") {
    throw new Error(`expected Ok, received ${outcome.failure.kind}`);
  }
  return outcome.value;
};

const expectFailure = async (value: string): Promise<DecodeFailure> => {
  const outcome = await decodeSamlParameter(value);
  if (outcome.kind !== "Failed") {
    throw new Error(`expected Failed, received Ok`);
  }
  return outcome.failure;
};

describe("POST binding, no compression", () => {
  it("decodes and reports no compression", async () => {
    const encoded = encodeURIComponent(
      encodeBase64(new TextEncoder().encode(ASSERTION)),
    );

    const decoded = await expectOk(encoded);

    expect(decoded.xml).toBe(ASSERTION);
    expect(decoded.compression).toBe("None");
  });
});

describe("redirect binding", () => {
  it("decodes raw DEFLATE and reports Deflate", async () => {
    const decoded = await expectOk(await compress(ASSERTION, "deflate-raw"));

    expect(decoded.xml).toBe(ASSERTION);
    expect(decoded.compression).toBe("Deflate");
  });

  it("decodes gzip and reports Gzip", async () => {
    const decoded = await expectOk(await compress(ASSERTION, "gzip"));

    expect(decoded.xml).toBe(ASSERTION);
    expect(decoded.compression).toBe("Gzip");
  });

  it("does not confuse gzip for deflate", async () => {
    const gzip = await expectOk(await compress(ASSERTION, "gzip"));
    const deflate = await expectOk(await compress(ASSERTION, "deflate-raw"));

    expect(gzip.compression).not.toBe(deflate.compression);
  });
});

describe("symmetry", () => {
  const cases: Compression[] = ["None", "Deflate", "Gzip"];

  for (const compression of cases) {
    it(`round-trips ${compression}`, async () => {
      const encoded = await encodeSamlParameter(ASSERTION, compression);
      const decoded = await expectOk(encoded);

      expect(decoded.xml).toBe(ASSERTION);
      expect(decoded.compression).toBe(compression);
      expect(await encodeSamlParameter(decoded.xml, decoded.compression)).toBe(
        encoded,
      );
    });
  }
});

describe("failures", () => {
  it("reports InvalidBase64 on characters outside the alphabet", async () => {
    expect(await expectFailure("not base64 !!")).toStrictEqual({
      kind: "InvalidBase64",
    });
  });

  it("reports DecompressionFailed on base64 that is neither compressed nor XML", async () => {
    const junk = encodeBase64(new Uint8Array([0x01, 0x02, 0x03, 0x04]));

    expect(await expectFailure(junk)).toStrictEqual({
      kind: "DecompressionFailed",
    });
  });
});

describe("url encoding", () => {
  it("survives a payload whose base64 contains +, / and =", async () => {
    const bytes = new Uint8Array([0xfb, 0xef, 0xbe, 0xff, 0xff, 0xff]);
    const base64 = encodeBase64(bytes);

    expect(base64).toContain("+");
    expect(base64).toContain("/");

    expect(await expectFailure(encodeURIComponent(base64))).toStrictEqual({
      kind: "DecompressionFailed",
    });
  });

  it("strips whitespace and line breaks before decoding", async () => {
    const base64 = encodeBase64(new TextEncoder().encode(ASSERTION));
    const wrapped = `${base64.slice(0, 40)}\r\n${base64.slice(40)}`;

    const decoded = await expectOk(encodeURIComponent(wrapped));

    expect(decoded.xml).toBe(ASSERTION);
  });

  it("treats an unescaped + as a plus, not as a space", async () => {
    const xml = `<a>${String.fromCharCode(0xfb, 0xef, 0xbe)}</a>`;
    const base64 = encodeBase64(new TextEncoder().encode(xml));
    expect(base64).toContain("+");

    const escaped = await expectOk(encodeURIComponent(base64));
    const unescaped = await expectOk(base64);

    expect(unescaped.xml).toBe(escaped.xml);
  });
});
