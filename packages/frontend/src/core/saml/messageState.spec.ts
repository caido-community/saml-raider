// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { buildMessageState } from "./messageState";

import { type DecodeOutcome, type SamlAnalysis } from "@/types";

const ASSERTION = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Issuer>https://idp.example.com</saml:Issuer><saml:Assertion ID="_a1"><saml:Subject><saml:NameID>alice@example.com</saml:NameID></saml:Subject></saml:Assertion></samlp:Response>`;

const POST_BINDING: SamlAnalysis = {
  kind: "Parameter",
  name: "SAMLResponse",
  value: "irrelevant",
  source: "Body",
  isSamlRequest: false,
};

const decoded = (xml: string): DecodeOutcome => ({
  kind: "Ok",
  value: { xml, compression: "None" },
});

describe("analysis decides the state before the outcome does", () => {
  it("is NotSaml when the analysis found nothing, whatever the outcome says", () => {
    const state = buildMessageState({ kind: "NotSaml" }, decoded(ASSERTION));

    expect(state).toStrictEqual({ kind: "NotSaml" });
  });

  it("is NotSaml for XML that carries no assertion", () => {
    const state = buildMessageState(
      { kind: "XmlWithoutAssertion" },
      decoded(ASSERTION),
    );

    expect(state).toStrictEqual({ kind: "NotSaml" });
  });
});

describe("a decoded message", () => {
  it("carries the analysis, the raw XML, the pretty XML and the parsed info", () => {
    const state = buildMessageState(POST_BINDING, decoded(ASSERTION));

    if (state.kind !== "Decoded") {
      throw new Error(`expected Decoded, received ${state.kind}`);
    }

    expect(state.analysis).toStrictEqual(POST_BINDING);
    expect(state.compression).toBe("None");
    expect(state.xml).toBe(ASSERTION);
    expect(state.prettyXml).toContain("\n  <saml:Issuer>");
    expect(state.info.issuer).toBe("https://idp.example.com");
    expect(state.info.subject).toBe("alice@example.com");
  });

  it("leaves the raw XML byte-identical, because it is what gets re-signed", () => {
    const state = buildMessageState(POST_BINDING, decoded(ASSERTION));

    expect(state.kind === "Decoded" && state.xml).toBe(ASSERTION);
  });
});

describe("failures", () => {
  it("passes a codec failure through untouched", () => {
    const state = buildMessageState(POST_BINDING, {
      kind: "Failed",
      failure: { kind: "InvalidBase64" },
    });

    expect(state).toStrictEqual({
      kind: "DecodeFailed",
      failure: { kind: "InvalidBase64" },
    });
  });

  it("reports MalformedXml when the decoded bytes do not parse", () => {
    const state = buildMessageState(POST_BINDING, decoded("<a><b></a>"));

    if (state.kind !== "DecodeFailed") {
      throw new Error(`expected DecodeFailed, received ${state.kind}`);
    }

    expect(state.failure.kind).toBe("MalformedXml");
  });
});
