import { DEFAULT_PARAMETER_NAMES, type ParameterNames } from "shared";
import { describe, expect, it } from "vitest";

import { looksLikeSaml } from "./detection";

const post = (body: string) =>
  `POST /acs HTTP/1.1\r\nHost: sp.example\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n${body}`;

describe("deciding whether traffic is worth looking at", () => {
  it("recognises a response posted to an assertion consumer", () => {
    expect(
      looksLikeSaml(post("SAMLResponse=PHNhbWw"), DEFAULT_PARAMETER_NAMES),
    ).toBe(true);
  });

  it("recognises a request on the redirect binding", () => {
    expect(
      looksLikeSaml(
        "GET /sso?SAMLRequest=fZJNT&RelayState=x HTTP/1.1\r\nHost: idp.example\r\n\r\n",
        DEFAULT_PARAMETER_NAMES,
      ),
    ).toBe(true);
  });

  it("ignores traffic that merely mentions the word", () => {
    expect(
      looksLikeSaml(
        post("note=we+use+SAMLResponse+here"),
        DEFAULT_PARAMETER_NAMES,
      ),
    ).toBe(false);
  });

  it("ignores ordinary traffic", () => {
    expect(
      looksLikeSaml(post("username=a&password=b"), DEFAULT_PARAMETER_NAMES),
    ).toBe(false);
  });

  it("honours renamed parameters", () => {
    const names: ParameterNames = {
      samlRequest: "AuthnReq",
      samlResponse: "AuthnResp",
    };

    expect(looksLikeSaml(post("AuthnResp=x"), names)).toBe(true);
    expect(looksLikeSaml(post("SAMLResponse=x"), names)).toBe(false);
  });

  it("stays cheap on a very large body rather than scanning all of it", () => {
    const huge = post(`${"a".repeat(2 * 1024 * 1024)}&SAMLResponse=x`);

    const started = Date.now();
    const outcome = looksLikeSaml(huge, DEFAULT_PARAMETER_NAMES);

    expect(outcome).toBe(false);
    expect(Date.now() - started).toBeLessThan(50);
  });
});
