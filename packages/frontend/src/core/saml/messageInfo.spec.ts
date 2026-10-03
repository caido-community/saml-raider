// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { readMessageInfo } from "./messageInfo";
import { parseXml } from "./xml";

import {
  ADFS_SHAPED_RESPONSE,
  buildMessageInfo,
  LOGOUT_REQUEST,
  SAML_RESPONSE,
  SHIBBOLETH_SHAPED_RESPONSE,
} from "@/tests/fixtures";

const parsed = (xml: string): Document => {
  const outcome = parseXml(xml);
  if (outcome.kind !== "Ok") {
    throw new Error(`expected Ok, received ${outcome.kind}`);
  }
  return outcome.document;
};

const info = (xml: string) => readMessageInfo(parsed(xml));

describe("message kind", () => {
  const kinds = [
    ["Response", "samlp:Response"],
    ["AuthnRequest", "samlp:AuthnRequest"],
    ["LogoutRequest", "samlp:LogoutRequest"],
    ["LogoutResponse", "samlp:LogoutResponse"],
    ["ArtifactResolve", "samlp:ArtifactResolve"],
  ] as const;

  for (const [expected, element] of kinds) {
    it(`recognises ${expected}`, () => {
      const xml = `<${element} xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_1"/>`;

      expect(info(xml).kind).toBe(expected);
    });
  }

  it("reports Unknown for a non-SAML root", () => {
    expect(info("<html/>").kind).toBe("Unknown");
  });

  it("recognises the kind whatever the namespace prefix is", () => {
    const withOther = `<zz:LogoutRequest xmlns:zz="urn:oasis:names:tc:SAML:2.0:protocol" ID="_1"/>`;
    const withNone = `<LogoutRequest ID="_1"/>`;

    expect(info(withOther).kind).toBe("LogoutRequest");
    expect(info(withNone).kind).toBe("LogoutRequest");
  });
});

describe("protocol metadata from the root element", () => {
  it("reads ID, InResponseTo, Destination and IssueInstant", () => {
    const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_r1" InResponseTo="_req9" Destination="https://sp.example.com/acs" IssueInstant="2026-01-01T00:00:00Z"/>`;

    expect(info(xml)).toMatchObject({
      id: "_r1",
      inResponseTo: "_req9",
      destination: "https://sp.example.com/acs",
      issueInstant: "2026-01-01T00:00:00Z",
    });
  });

  it("leaves absent attributes undefined rather than empty strings", () => {
    const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_r1"/>`;

    expect(info(xml)).toMatchObject({
      inResponseTo: undefined,
      destination: undefined,
    });
  });

  it("reads the status code of a failed response", () => {
    const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Requester"/></samlp:Status></samlp:Response>`;

    expect(info(xml).statusCode).toBe(
      "urn:oasis:names:tc:SAML:2.0:status:Requester",
    );
  });
});

describe("assertion counting", () => {
  it("counts a single assertion", () => {
    expect(info(SAML_RESPONSE).assertionCount).toBe(1);
  });

  it("counts multiple assertions, which XSW payloads rely on", () => {
    const xml = `<r><Assertion ID="_a1"/><Assertion ID="_a2"/><Assertion ID="_a3"/></r>`;

    expect(info(xml).assertionCount).toBe(3);
  });

  it("counts encrypted assertions separately from plain ones", () => {
    const xml = `<r><Assertion ID="_a1"/><EncryptedAssertion/><EncryptedAssertion/></r>`;

    expect(info(xml)).toMatchObject({
      assertionCount: 1,
      encryptedAssertionCount: 2,
    });
  });

  it("reports zero rather than undefined when there are none", () => {
    expect(info("<r/>")).toMatchObject({
      assertionCount: 0,
      encryptedAssertionCount: 0,
    });
  });
});

describe("signature locations", () => {
  it("reports which element carries the signature", () => {
    expect(info(SAML_RESPONSE).signedElements).toStrictEqual([
      { element: "Response", id: "_r1" },
    ]);
  });

  it("distinguishes a response signature from an assertion signature", () => {
    const xml = `<Response ID="_r1"><Signature/><Assertion ID="_a1"><Signature/></Assertion></Response>`;

    expect(info(xml).signedElements).toStrictEqual([
      { element: "Response", id: "_r1" },
      { element: "Assertion", id: "_a1" },
    ]);
  });

  it("reports an empty list for an unsigned message", () => {
    expect(info("<Response ID='_r1'/>").signedElements).toStrictEqual([]);
  });
});

describe("duplicate IDs, the precondition for signature wrapping", () => {
  it("flags two elements sharing an ID", () => {
    const xml = `<r><Assertion ID="_same"/><Assertion ID="_same"/></r>`;

    expect(info(xml).hasDuplicateIds).toBe(true);
  });

  it("does not flag distinct IDs", () => {
    const xml = `<r><Assertion ID="_a1"/><Assertion ID="_a2"/></r>`;

    expect(info(xml).hasDuplicateIds).toBe(false);
  });

  it("does not flag elements that simply have no ID", () => {
    expect(info("<r><a/><b/></r>").hasDuplicateIds).toBe(false);
  });
});

describe("assertion detail", () => {
  it("reads every field the Message Info panel shows", () => {
    expect(info(SAML_RESPONSE)).toMatchObject({
      issuer: "https://idp.example.com",
      conditionNotBefore: "2026-01-01T00:00:00Z",
      conditionNotAfter: "2026-01-01T02:00:00Z",
      subject: "alice@example.com",
      subjectConfirmationNotBefore: "2026-01-01T00:00:00Z",
      subjectConfirmationNotAfter: "2026-01-01T01:00:00Z",
      signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
      digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
      encryptionMethod: undefined,
      certificates: ["MIIC-base64"],
    });
  });

  it("returns undefined for every optional field on an unrelated document", () => {
    const unrelated = info("<html><body/></html>");

    expect(unrelated).toMatchObject({
      issuer: undefined,
      subject: undefined,
      signatureAlgorithm: undefined,
      certificates: [],
    });
  });

  it("works when the document uses no prefixes at all", () => {
    expect(info("<Response><Issuer>idp</Issuer></Response>").issuer).toBe(
      "idp",
    );
  });
});

describe("distinct vendor message shapes", () => {
  it("reads an ADFS-shaped response where the signature sits on the assertion", () => {
    const result = buildMessageInfo(ADFS_SHAPED_RESPONSE);

    expect(result).toMatchObject({
      kind: "Response",
      id: "_adfs1",
      inResponseTo: "_req1",
      destination: "https://sp.example.com/acs",
      statusCode: "urn:oasis:names:tc:SAML:2.0:status:Success",
      issuer: "http://adfs.example.com/adfs/services/trust",
      subject: "bob@example.com",
      assertionCount: 1,
      encryptedAssertionCount: 0,
    });
    expect(result.signedElements).toStrictEqual([
      { element: "Assertion", id: "_adfsA1" },
    ]);
  });

  it("reads a Shibboleth-shaped response carrying an encrypted assertion", () => {
    const result = buildMessageInfo(SHIBBOLETH_SHAPED_RESPONSE);

    expect(result).toMatchObject({
      kind: "Response",
      id: "_shib1",
      issuer: "https://samltest.id/saml/idp",
      assertionCount: 0,
      encryptedAssertionCount: 1,
      encryptionMethod: "http://www.w3.org/2009/xmlenc11#aes256-gcm",
      subject: undefined,
    });
    expect(result.signedElements).toStrictEqual([]);
  });

  it("reads a logout request, which carries no assertion at all", () => {
    const result = buildMessageInfo(LOGOUT_REQUEST);

    expect(result).toMatchObject({
      kind: "LogoutRequest",
      id: "_lo1",
      destination: "https://idp.example.com/slo",
      issuer: "https://sp.example.com",
      subject: "carol@example.com",
      assertionCount: 0,
      statusCode: undefined,
    });
  });

  it("agrees on the three prefix conventions the vendors use", () => {
    const kinds = [
      ADFS_SHAPED_RESPONSE,
      SHIBBOLETH_SHAPED_RESPONSE,
      SAML_RESPONSE,
    ].map((xml) => buildMessageInfo(xml).kind);

    expect(kinds).toStrictEqual(["Response", "Response", "Response"]);
  });
});
