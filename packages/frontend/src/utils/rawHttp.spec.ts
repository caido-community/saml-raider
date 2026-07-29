import { describe, expect, it } from "vitest";

import {
  readBody,
  readFormParameter,
  readHeader,
  readQueryString,
} from "./rawHttp";

const CRLF = [
  "POST /sso/acs?RelayState=%2Fdash&x=1 HTTP/1.1",
  "Host: sp.example.com",
  "Content-Type: application/x-www-form-urlencoded",
  "",
  "SAMLResponse=PHNhbWw%2B&RelayState=%2Fdash",
].join("\r\n");

const LF = CRLF.replace(/\r\n/g, "\n");

describe("readHeader", () => {
  it("reads a header case-insensitively", () => {
    expect(readHeader(CRLF, "content-type")).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(readHeader(CRLF, "Content-Type")).toBe(
      "application/x-www-form-urlencoded",
    );
  });

  it("returns undefined when absent", () => {
    expect(readHeader(CRLF, "authorization")).toBeUndefined();
  });

  it("never matches the request line", () => {
    expect(
      readHeader(CRLF, "POST /sso/acs?RelayState=%2Fdash&x=1 HTTP/1.1"),
    ).toBeUndefined();
  });

  it("works on an LF-normalized request", () => {
    expect(readHeader(LF, "host")).toBe("sp.example.com");
  });
});

describe("readQueryString", () => {
  it("reads the query from the request line", () => {
    expect(readQueryString(CRLF)).toBe("RelayState=%2Fdash&x=1");
  });

  it("returns empty when the target has no query", () => {
    expect(readQueryString("GET /sso HTTP/1.1\r\nHost: a\r\n\r\n")).toBe("");
  });
});

describe("readBody", () => {
  it("reads the body after CRLFCRLF", () => {
    expect(readBody(CRLF)).toBe("SAMLResponse=PHNhbWw%2B&RelayState=%2Fdash");
  });

  it("reads the body after LFLF", () => {
    expect(readBody(LF)).toBe("SAMLResponse=PHNhbWw%2B&RelayState=%2Fdash");
  });

  it("returns empty when there is no body", () => {
    expect(readBody("GET / HTTP/1.1\r\nHost: a\r\n\r\n")).toBe("");
  });
});

describe("readFormParameter", () => {
  it("reads from the body", () => {
    expect(readFormParameter(CRLF, "SAMLResponse", "Body")).toBe("PHNhbWw%2B");
  });

  it("reads from the query", () => {
    expect(readFormParameter(CRLF, "RelayState", "Query")).toBe("%2Fdash");
  });

  it("does not leak between sources", () => {
    expect(readFormParameter(CRLF, "SAMLResponse", "Query")).toBeUndefined();
    expect(readFormParameter(CRLF, "x", "Body")).toBeUndefined();
  });

  it("returns the value still percent-encoded, so the codec decodes exactly once", () => {
    expect(readFormParameter(CRLF, "SAMLResponse", "Body")).toContain("%2B");
  });

  it("does not match a parameter whose name is a suffix of another", () => {
    const raw =
      "POST / HTTP/1.1\r\nHost: a\r\n\r\nXSAMLResponse=nope&SAMLResponse=yes";

    expect(readFormParameter(raw, "SAMLResponse", "Body")).toBe("yes");
  });
});
