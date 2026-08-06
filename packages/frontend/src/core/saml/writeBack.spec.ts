import { describe, expect, it } from "vitest";

import { buildRawWithSaml, type TransportTarget } from "./writeBack";

const XML = "<r/>";

const target = (overrides: Partial<TransportTarget> = {}): TransportTarget => ({
  name: "SAMLResponse",
  source: "Body",
  compression: "None",
  ...overrides,
});

const postRequest = (body: string) =>
  `POST /acs HTTP/1.1\r\nHost: sp.example.com\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n${body}`;

const getRequest = (query: string) =>
  `GET /sso?${query} HTTP/1.1\r\nHost: idp.example.com\r\n\r\n`;

const write = (overrides: {
  raw: string;
  target?: TransportTarget;
  isReadOnly?: boolean;
  isStrippingDetachedSignature?: boolean;
}) =>
  buildRawWithSaml({
    raw: overrides.raw,
    xml: XML,
    target: overrides.target ?? target(),
    isReadOnly: overrides.isReadOnly ?? false,
    isStrippingDetachedSignature:
      overrides.isStrippingDetachedSignature ?? false,
  });

describe("refusing to write", () => {
  it("never writes to a read-only view", () => {
    expect(
      write({ raw: postRequest("SAMLResponse=old"), isReadOnly: true }),
    ).toEqual({ kind: "Failed", reason: "ReadOnly" });
  });

  it("reports a parameter that is not in the message", () => {
    expect(write({ raw: postRequest("RelayState=x") })).toEqual({
      kind: "Failed",
      reason: "ParameterMissing",
    });
  });

  it("reports a query write when the target carries no query", () => {
    expect(
      write({
        raw: "GET /sso HTTP/1.1\r\nHost: idp\r\n\r\n",
        target: target({ source: "Query" }),
      }),
    ).toEqual({ kind: "Failed", reason: "ParameterMissing" });
  });
});

describe("replacing the transport value", () => {
  it("rewrites only the named body parameter", () => {
    const outcome = write({
      raw: postRequest("RelayState=%2Fdash&SAMLResponse=old&Other=keep"),
    });
    if (outcome.kind !== "Ok") throw new Error("expected a rewritten request");

    expect(outcome.raw).toContain("RelayState=%2Fdash");
    expect(outcome.raw).toContain("Other=keep");
    expect(outcome.raw).not.toContain("SAMLResponse=old");
  });

  it("keeps the headers and the request line", () => {
    const outcome = write({ raw: postRequest("SAMLResponse=old") });
    if (outcome.kind !== "Ok") throw new Error("expected a rewritten request");

    expect(outcome.raw).toContain("POST /acs HTTP/1.1");
    expect(outcome.raw).toContain("Host: sp.example.com");
  });

  it("rewrites a query parameter without disturbing the rest of the line", () => {
    const outcome = write({
      raw: getRequest("SAMLRequest=old&RelayState=%2Fdash"),
      target: target({ name: "SAMLRequest", source: "Query" }),
    });
    if (outcome.kind !== "Ok") throw new Error("expected a rewritten request");

    expect(outcome.raw).toMatch(/^GET \/sso\?/);
    expect(outcome.raw).toContain("HTTP/1.1");
    expect(outcome.raw).toContain("RelayState=%2Fdash");
  });

  it("preserves line endings that are not CRLF", () => {
    const outcome = write({
      raw: "GET /sso?SAMLRequest=old HTTP/1.1\nHost: idp\n\n",
      target: target({ name: "SAMLRequest", source: "Query" }),
    });
    if (outcome.kind !== "Ok") throw new Error("expected a rewritten request");

    expect(outcome.raw).not.toContain("\r\n");
  });

  it("compresses when the original binding did", () => {
    const plain = write({ raw: postRequest("SAMLResponse=old") });
    const deflated = write({
      raw: postRequest("SAMLResponse=old"),
      target: target({ compression: "Deflate" }),
    });

    expect(plain.kind === "Ok" && deflated.kind === "Ok").toBe(true);
    expect(plain.kind === "Ok" && plain.raw).not.toBe(
      deflated.kind === "Ok" && deflated.raw,
    );
  });
});

describe("detached Redirect-binding signatures", () => {
  const signedRedirect = getRequest(
    "SAMLRequest=old&SigAlg=alg&Signature=sig&RelayState=%2Fdash",
  );
  const queryTarget = target({ name: "SAMLRequest", source: "Query" });

  it("blocks rather than sending a signature that can no longer verify", () => {
    const outcome = write({ raw: signedRedirect, target: queryTarget });

    expect(outcome.kind).toBe("BlockedByDetachedSignature");
    expect(
      outcome.kind === "BlockedByDetachedSignature" &&
        outcome.stale.map((entry) => entry.name),
    ).toEqual(["SigAlg", "Signature"]);
  });

  it("strips them when the user confirms", () => {
    const outcome = write({
      raw: signedRedirect,
      target: queryTarget,
      isStrippingDetachedSignature: true,
    });
    if (outcome.kind !== "Ok") throw new Error("expected a rewritten request");

    expect(outcome.raw).not.toContain("SigAlg=");
    expect(outcome.raw).not.toContain("Signature=");
    expect(outcome.raw).toContain("RelayState=%2Fdash");
  });

  it("does not block a POST binding, which carries no detached signature", () => {
    const outcome = write({ raw: postRequest("SAMLResponse=old&SigAlg=alg") });

    expect(outcome.kind).toBe("Ok");
  });
});
