import { type SignatureAlgorithm } from "shared";
import { describe, expect, it } from "vitest";

import {
  EXCLUSIVE_C14N_URI,
  readCanonicalization,
  readDigestAlgorithm,
  readDigestMethodUri,
  readSignatureAlgorithm,
  readSignatureMethodUri,
} from "./algorithms";

const ALL: SignatureAlgorithm[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

describe("round tripping the advertised algorithms", () => {
  it.each(ALL)("%s signature method", (algorithm) => {
    expect(readSignatureAlgorithm(readSignatureMethodUri(algorithm))).toBe(
      algorithm,
    );
  });

  it.each(ALL)("%s digest method", (algorithm) => {
    expect(readDigestAlgorithm(readDigestMethodUri(algorithm))).toBe(algorithm);
  });

  it("uses the URIs identity providers actually emit", () => {
    expect(readSignatureMethodUri("SHA-256")).toBe(
      "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    );
    expect(readDigestMethodUri("SHA-256")).toBe(
      "http://www.w3.org/2001/04/xmlenc#sha256",
    );
    expect(readSignatureMethodUri("SHA-1")).toBe(
      "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    );
  });
});

describe("refusing what is not advertised", () => {
  it.each([
    "http://www.w3.org/2001/04/xmldsig-more#hmac-sha256",
    "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256",
    "http://www.w3.org/2000/09/xmldsig#dsa-sha1",
    "http://www.w3.org/2001/04/xmlenc#ripemd160",
    "",
    "not a uri",
  ])("rejects %s as a signature method", (uri) => {
    expect(readSignatureAlgorithm(uri)).toBeUndefined();
  });

  it("does not accept a digest URI as a signature method", () => {
    expect(
      readSignatureAlgorithm("http://www.w3.org/2001/04/xmlenc#sha256"),
    ).toBeUndefined();
  });

  it("does not accept a signature URI as a digest method", () => {
    expect(
      readDigestAlgorithm("http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"),
    ).toBeUndefined();
  });
});

describe("canonicalization", () => {
  it("accepts both exclusive variants and nothing else", () => {
    expect(readCanonicalization(EXCLUSIVE_C14N_URI)).toBe("Exclusive");
    expect(
      readCanonicalization(
        "http://www.w3.org/2001/10/xml-exc-c14n#WithComments",
      ),
    ).toBe("ExclusiveWithComments");
    expect(
      readCanonicalization("http://www.w3.org/TR/2001/REC-xml-c14n-20010315"),
    ).toBeUndefined();
  });
});
