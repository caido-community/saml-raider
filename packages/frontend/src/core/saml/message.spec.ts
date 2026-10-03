import { describe, expect, it } from "vitest";

import { analyzeSamlMessage } from "./analyzer";
import { decodeMessage } from "./message";

import {
  buildRawRequest,
  FORM_CONTENT_TYPE,
  XML_CONTENT_TYPE,
} from "@/tests/fixtures";
import { encodeBase64 } from "@/utils";

const ASSERTION =
  '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"><saml:Assertion ID="_a1"/></samlp:Response>';

const request = buildRawRequest;
const FORM = FORM_CONTENT_TYPE;
const XML = XML_CONTENT_TYPE;

const decode = (raw: string) => decodeMessage(raw, analyzeSamlMessage(raw));

describe("POST binding", () => {
  it("decodes the base64 parameter out of the body", () => {
    const parameter = encodeURIComponent(
      encodeBase64(new TextEncoder().encode(ASSERTION)),
    );
    const raw = request(
      "POST /acs HTTP/1.1",
      [FORM],
      `SAMLResponse=${parameter}&RelayState=%2Fdash`,
    );

    expect(decode(raw)).toStrictEqual({
      kind: "Ok",
      value: { xml: ASSERTION, compression: "None" },
    });
  });
});

describe("SOAP", () => {
  it("returns the body verbatim, without touching the headers", () => {
    const raw = request("POST /sso HTTP/1.1", [XML], ASSERTION);

    expect(decode(raw)).toStrictEqual({
      kind: "Ok",
      value: { xml: ASSERTION, compression: "None" },
    });
  });
});

describe("WS-Federation", () => {
  it("url-decodes wresult when the body is form-urlencoded", () => {
    const raw = request(
      "POST /sso HTTP/1.1",
      [FORM],
      `wresult=${encodeURIComponent(ASSERTION)}`,
    );

    expect(decode(raw)).toStrictEqual({
      kind: "Ok",
      value: { xml: ASSERTION, compression: "None" },
    });
  });

  it("leaves wresult alone when the body is not form-urlencoded", () => {
    const raw = request(
      "POST /sso HTTP/1.1",
      ["Content-Type: text/plain"],
      `wresult=${ASSERTION}`,
    );

    expect(decode(raw)).toStrictEqual({
      kind: "Ok",
      value: { xml: ASSERTION, compression: "None" },
    });
  });
});

describe("non-SAML traffic", () => {
  it("fails with NotSaml rather than returning empty XML", () => {
    const raw = request("GET /index.html HTTP/1.1", ["Host: example.com"]);

    expect(decode(raw)).toStrictEqual({
      kind: "Failed",
      failure: { kind: "NotSaml" },
    });
  });

  it("fails with NotSaml on XML that carries no assertion", () => {
    const raw = request(
      "POST /sso HTTP/1.1",
      [XML],
      "<Envelope><Body/></Envelope>",
    );

    expect(decode(raw)).toStrictEqual({
      kind: "Failed",
      failure: { kind: "NotSaml" },
    });
  });
});

describe("malformed input never throws past the boundary", () => {
  it("returns MalformedUrlEncoding for a broken SAML parameter", () => {
    const raw = request("POST /acs HTTP/1.1", [FORM], "SAMLResponse=%");

    expect(decode(raw)).toStrictEqual({
      kind: "Failed",
      failure: { kind: "MalformedUrlEncoding" },
    });
  });

  it("returns MalformedUrlEncoding for a broken wresult", () => {
    const raw = request("POST /sso HTTP/1.1", [FORM], "wresult=%E0%A4%A");

    expect(decode(raw)).toStrictEqual({
      kind: "Failed",
      failure: { kind: "MalformedUrlEncoding" },
    });
  });
});

describe("failures reach the caller", () => {
  it("surfaces InvalidBase64 from the codec", () => {
    const raw = request("POST /acs HTTP/1.1", [FORM], "SAMLResponse=!!not!!");

    expect(decode(raw)).toStrictEqual({
      kind: "Failed",
      failure: { kind: "InvalidBase64" },
    });
  });
});
