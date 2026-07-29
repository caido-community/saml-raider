import { describe, expect, it } from "vitest";

import { analyzeSamlMessage, isLikelySamlMessage } from "./analyzer";

const request = (line: string, headers: string[], body = ""): string =>
  [line, ...headers, "", body].join("\r\n");

const FORM = "Content-Type: application/x-www-form-urlencoded";
const XML = "Content-Type: text/xml; charset=utf-8";

describe("branch 1: XML content type", () => {
  it("is Soap when an Assertion is present", () => {
    const raw = request(
      "POST /sso HTTP/1.1",
      [XML],
      "<Envelope><saml:Assertion ID='_a'/></Envelope>",
    );

    expect(analyzeSamlMessage(raw).kind).toBe("Soap");
  });

  it("recognises an EncryptedAssertion", () => {
    const raw = request(
      "POST /sso HTTP/1.1",
      [XML],
      "<Envelope><saml:EncryptedAssertion/></Envelope>",
    );

    expect(analyzeSamlMessage(raw).kind).toBe("Soap");
  });

  it("is XmlWithoutAssertion when the body carries no Assertion", () => {
    const raw = request(
      "POST /sso HTTP/1.1",
      [XML],
      "<Envelope><Body/></Envelope>",
    );

    expect(analyzeSamlMessage(raw).kind).toBe("XmlWithoutAssertion");
  });

  it("wins over a wresult parameter, because branch order is load-bearing", () => {
    const raw = request(
      "POST /sso HTTP/1.1",
      [XML],
      "<Envelope><saml:Assertion/></Envelope>&wresult=x",
    );

    expect(analyzeSamlMessage(raw).kind).toBe("Soap");
  });
});

describe("branch 2: WS-Federation", () => {
  it("detects wresult in the body", () => {
    const raw = request(
      "POST /sso HTTP/1.1",
      [FORM],
      "wresult=%3Ct%3E&wa=signin",
    );

    const analysis = analyzeSamlMessage(raw);

    expect(analysis).toMatchObject({
      kind: "WsFederation",
      isUrlEncoded: true,
    });
  });

  it("reports isUrlEncoded false when the content type is not form-urlencoded", () => {
    const raw = request(
      "POST /sso HTTP/1.1",
      ["Content-Type: text/plain"],
      "wresult=x",
    );

    expect(analyzeSamlMessage(raw)).toMatchObject({
      kind: "WsFederation",
      isUrlEncoded: false,
    });
  });

  it("ignores wresult in the query, matching Burp which only checks the body", () => {
    const raw = request("GET /sso?wresult=x HTTP/1.1", ["Host: a"]);

    expect(analyzeSamlMessage(raw).kind).toBe("NotSaml");
  });
});

describe("branch 3: SAML parameters", () => {
  it("finds SAMLResponse in a POST body", () => {
    const raw = request("POST /acs HTTP/1.1", [FORM], "SAMLResponse=PHM%2B");

    expect(analyzeSamlMessage(raw)).toMatchObject({
      kind: "Parameter",
      name: "SAMLResponse",
      source: "Body",
      isSamlRequest: false,
      value: "PHM%2B",
    });
  });

  it("finds SAMLRequest in a redirect-binding query", () => {
    const raw = request("GET /sso?SAMLRequest=fZJN HTTP/1.1", ["Host: idp"]);

    expect(analyzeSamlMessage(raw)).toMatchObject({
      kind: "Parameter",
      name: "SAMLRequest",
      source: "Query",
      isSamlRequest: true,
    });
  });

  it("prefers a response over a request when both are present", () => {
    const raw = request(
      "POST /acs HTTP/1.1",
      [FORM],
      "SAMLRequest=a&SAMLResponse=b",
    );

    expect(analyzeSamlMessage(raw)).toMatchObject({
      name: "SAMLResponse",
      isSamlRequest: false,
    });
  });

  it("prefers the body over the query for the same name", () => {
    const raw = request(
      "POST /acs?SAMLResponse=fromQuery HTTP/1.1",
      [FORM],
      "SAMLResponse=fromBody",
    );

    expect(analyzeSamlMessage(raw)).toMatchObject({
      source: "Body",
      value: "fromBody",
    });
  });

  it("honours custom parameter names", () => {
    const raw = request("POST /acs HTTP/1.1", [FORM], "MySamlResp=abc");

    expect(
      analyzeSamlMessage(raw, {
        samlRequest: "MySamlReq",
        samlResponse: "MySamlResp",
      }),
    ).toMatchObject({
      kind: "Parameter",
      name: "MySamlResp",
    });
  });

  it("does not find a default name when custom names are configured", () => {
    const raw = request("POST /acs HTTP/1.1", [FORM], "SAMLResponse=abc");

    expect(
      analyzeSamlMessage(raw, {
        samlRequest: "MySamlReq",
        samlResponse: "MySamlResp",
      }).kind,
    ).toBe("NotSaml");
  });
});

describe("non-SAML traffic", () => {
  it("reports NotSaml", () => {
    const raw = request("GET /index.html HTTP/1.1", ["Host: example.com"]);

    expect(analyzeSamlMessage(raw).kind).toBe("NotSaml");
  });
});

describe("isLikelySamlMessage", () => {
  it("accepts every shape the analyzer accepts", () => {
    const cases = [
      {
        raw: request("POST /acs HTTP/1.1", [FORM], "SAMLResponse=abc"),
        kind: "Parameter",
      },
      {
        raw: request("GET /sso?SAMLRequest=abc HTTP/1.1", ["Host: idp"]),
        kind: "Parameter",
      },
      {
        raw: request("POST /sso HTTP/1.1", [FORM], "wresult=abc"),
        kind: "WsFederation",
      },
      {
        raw: request(
          "POST /sso HTTP/1.1",
          [XML],
          "<Envelope><saml:Assertion/></Envelope>",
        ),
        kind: "Soap",
      },
    ];

    for (const { raw, kind } of cases) {
      expect(analyzeSamlMessage(raw).kind).toBe(kind);
      expect(isLikelySamlMessage(raw)).toBe(true);
    }
  });

  it("rejects ordinary traffic, so the tab does not follow every request", () => {
    const raw = request("GET /index.html HTTP/1.1", ["Host: example.com"]);

    expect(isLikelySamlMessage(raw)).toBe(false);
  });

  it("accepts a half-typed draft the analyzer rejects, which is why it gates the tab", () => {
    const draft = "POST /acs HTTP/1.1\r\nHost: sp\r\nX-Note: SAMLResponse";

    expect(analyzeSamlMessage(draft).kind).toBe("NotSaml");
    expect(isLikelySamlMessage(draft)).toBe(true);
  });

  it("accepts a SAML message wrapped in JSON, which the form parser cannot reach", () => {
    const raw = request(
      "POST /acs HTTP/1.1",
      ["Content-Type: application/json"],
      '{"SAMLResponse":"PHNhbWw+"}',
    );

    expect(analyzeSamlMessage(raw).kind).toBe("NotSaml");
    expect(isLikelySamlMessage(raw)).toBe(true);
  });

  it("treats an empty parameter value as present, matching isPresent", () => {
    const raw = request("POST /acs HTTP/1.1", [FORM], "SAMLResponse=");

    expect(analyzeSamlMessage(raw)).toMatchObject({
      kind: "Parameter",
      value: "",
    });
  });

  it("honours custom parameter names", () => {
    const raw = request("POST /acs HTTP/1.1", [FORM], "MySamlResp=abc");
    const names = { samlRequest: "MySamlReq", samlResponse: "MySamlResp" };

    expect(isLikelySamlMessage(raw)).toBe(false);
    expect(isLikelySamlMessage(raw, names)).toBe(true);
  });
});
