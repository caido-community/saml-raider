import { describe, expect, it } from "vitest";

import { analyzeSamlMessage, isSamlMessage } from "./analyzer";

import {
  buildRawRequest,
  FORM_CONTENT_TYPE,
  XML_CONTENT_TYPE,
} from "@/tests/fixtures";

const request = buildRawRequest;
const FORM = FORM_CONTENT_TYPE;
const XML = XML_CONTENT_TYPE;

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

describe("isSamlMessage, which gates the view mode", () => {
  it("accepts every shape the analyzer recognises", () => {
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
      const analysis = analyzeSamlMessage(raw);

      expect(analysis.kind).toBe(kind);
      expect(isSamlMessage(analysis)).toBe(true);
    }
  });

  it("rejects ordinary traffic, so the tab does not follow every request", () => {
    const raw = request("GET /index.html HTTP/1.1", ["Host: example.com"]);

    expect(isSamlMessage(analyzeSamlMessage(raw))).toBe(false);
  });

  it("rejects a request that only mentions the parameter name in a header", () => {
    const draft = "POST /acs HTTP/1.1\r\nHost: sp\r\nX-Note: SAMLResponse";

    expect(isSamlMessage(analyzeSamlMessage(draft))).toBe(false);
  });

  it("rejects a SAML message wrapped in JSON, which it cannot decode anyway", () => {
    const raw = request(
      "POST /acs HTTP/1.1",
      ["Content-Type: application/json"],
      '{"SAMLResponse":"PHNhbWw+"}',
    );

    expect(isSamlMessage(analyzeSamlMessage(raw))).toBe(false);
  });

  it("treats an empty parameter value as present, matching isPresent", () => {
    const raw = request("POST /acs HTTP/1.1", [FORM], "SAMLResponse=");

    expect(analyzeSamlMessage(raw)).toMatchObject({
      kind: "Parameter",
      value: "",
    });
  });
});

describe("duplicate SAML parameters, an HTTP parameter pollution vector", () => {
  it("flags a duplicated parameter and analyses the first occurrence", () => {
    const raw = request(
      "POST /acs HTTP/1.1",
      [FORM],
      "SAMLResponse=first&SAMLResponse=second",
    );

    expect(analyzeSamlMessage(raw)).toMatchObject({
      kind: "Parameter",
      value: "first",
      isDuplicated: true,
    });
  });

  it("does not flag a single parameter", () => {
    const raw = request("POST /acs HTTP/1.1", [FORM], "SAMLResponse=only");

    expect(analyzeSamlMessage(raw)).toMatchObject({ isDuplicated: false });
  });

  it("does not confuse a duplicate in the query with one in the body", () => {
    const raw = request(
      "POST /acs?SAMLResponse=q1&SAMLResponse=q2 HTTP/1.1",
      [FORM],
      "SAMLResponse=body",
    );

    expect(analyzeSamlMessage(raw)).toMatchObject({
      source: "Body",
      isDuplicated: false,
    });
  });
});

describe("messages embedded in something that is not a SAML binding", () => {
  it("finds a response carried inside an application specific stream", () => {
    const raw = buildRawRequest(
      "HTTP/1.1 200 OK",
      ["Content-Type: text/x-component"],
      "2:T182c,?SAMLResponse=PHNhbWwycDpSZXNwb25zZT48L3NhbWwycDpSZXNwb25zZT4%3D\n0:{}",
    );

    expect(analyzeSamlMessage(raw)).toStrictEqual({
      kind: "Embedded",
      name: "SAMLResponse",
      value: "PHNhbWwycDpSZXNwb25zZT48L3NhbWwycDpSZXNwb25zZT4%3D",
      isSamlRequest: false,
    });
  });

  it("prefers a real binding over an embedded match", () => {
    const raw = buildRawRequest(
      "POST /acs HTTP/1.1",
      [FORM_CONTENT_TYPE],
      "SAMLResponse=cHJvcGVy",
    );

    expect(analyzeSamlMessage(raw).kind).toBe("Parameter");
  });

  it("stops the value at the first delimiter rather than swallowing the stream", () => {
    const raw = buildRawRequest(
      "HTTP/1.1 200 OK",
      ["Content-Type: text/plain"],
      'x?SAMLRequest=YWJj&RelayState=zzz"tail',
    );
    const analysis = analyzeSamlMessage(raw);
    if (analysis.kind !== "Embedded")
      throw new Error("expected an embedded hit");

    expect(analysis.value).toBe("YWJj");
    expect(analysis.isSamlRequest).toBe(true);
  });

  it("still reports ordinary traffic as not SAML", () => {
    const raw = buildRawRequest(
      "HTTP/1.1 200 OK",
      ["Content-Type: text/html"],
      "<html>nothing here</html>",
    );

    expect(analyzeSamlMessage(raw)).toStrictEqual({ kind: "NotSaml" });
  });
});

describe("not mistaking a header for the message", () => {
  it("ignores a redirect binding URL echoed in a Referer header", () => {
    const raw = buildRawRequest(
      "GET /dashboard HTTP/1.1",
      [
        "Host: sp.example",
        "Referer: https://idp.example/sso?SAMLRequest=fZJNbxAAAA&RelayState=x",
      ],
      "",
    );

    expect(analyzeSamlMessage(raw)).toStrictEqual({ kind: "NotSaml" });
  });

  it("ignores a SAML parameter stored in a cookie", () => {
    const raw = buildRawRequest(
      "GET /app HTTP/1.1",
      ["Host: sp.example", "Cookie: last=SAMLResponse=PHNhbWw"],
      "",
    );

    expect(analyzeSamlMessage(raw)).toStrictEqual({ kind: "NotSaml" });
  });

  it("still finds a message embedded in the body", () => {
    const raw = buildRawRequest(
      "HTTP/1.1 200 OK",
      ["Content-Type: text/x-component"],
      "2:T182c,?SAMLResponse=PHNhbWw\n0:{}",
    );

    expect(analyzeSamlMessage(raw).kind).toBe("Embedded");
  });

  it("still finds one in the query string of a request", () => {
    const raw = buildRawRequest(
      "GET /go?redirect=https://idp.example/sso?SAMLRequest=fZJN HTTP/1.1",
      ["Host: idp.example"],
      "",
    );

    expect(analyzeSamlMessage(raw).kind).toBe("Embedded");
  });
});
