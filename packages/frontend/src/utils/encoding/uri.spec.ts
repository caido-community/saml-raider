import { describe, expect, it } from "vitest";

import { decodeUri } from "./uri";

describe("decodeUri", () => {
  it("decodes ordinary percent-encoding", () => {
    expect(decodeUri("%3Csaml%3E")).toBe("<saml>");
  });

  it("leaves an unescaped string untouched", () => {
    expect(decodeUri("PHNhbWw+")).toBe("PHNhbWw+");
  });

  it("returns undefined for a lone percent instead of throwing", () => {
    expect(decodeUri("%")).toBeUndefined();
  });

  it("returns undefined for a truncated multi-byte escape", () => {
    expect(decodeUri("%E0%A4%A")).toBeUndefined();
  });

  it("returns undefined for an invalid escape sequence", () => {
    expect(decodeUri("%ZZ")).toBeUndefined();
  });

  it("distinguishes an empty string from a failure", () => {
    expect(decodeUri("")).toBe("");
  });
});
