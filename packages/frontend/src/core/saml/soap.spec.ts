// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { buildSoapWithSaml, readSoapEnvelope } from "./soap";

const SOAP11 = "http://schemas.xmlsoap.org/soap/envelope/";
const SOAP12 = "http://www.w3.org/2003/05/soap-envelope";
const PROTOCOL = "urn:oasis:names:tc:SAML:2.0:protocol";

const envelope = (namespace: string, body: string, prefix = "s") =>
  `<${prefix}:Envelope xmlns:${prefix}="${namespace}"><${prefix}:Body>${body}</${prefix}:Body></${prefix}:Envelope>`;

const samlResponse = `<samlp:Response xmlns:samlp="${PROTOCOL}" ID="_r1"/>`;

describe("recognising envelopes", () => {
  it("accepts SOAP 1.1", () => {
    expect(readSoapEnvelope(envelope(SOAP11, samlResponse))).toMatchObject({
      kind: "WithSaml",
      version: "1.1",
      samlLocalName: "Response",
    });
  });

  it("accepts SOAP 1.2", () => {
    expect(readSoapEnvelope(envelope(SOAP12, samlResponse))).toMatchObject({
      kind: "WithSaml",
      version: "1.2",
    });
  });

  it("does not care which prefix the envelope uses", () => {
    expect(
      readSoapEnvelope(envelope(SOAP11, samlResponse, "soapenv")),
    ).toMatchObject({ kind: "WithSaml", version: "1.1" });
  });

  it("rejects a document that is not an envelope", () => {
    expect(readSoapEnvelope(samlResponse)).toEqual({ kind: "NotSoap" });
    expect(readSoapEnvelope("not xml at all")).toEqual({ kind: "NotSoap" });
  });

  it("rejects an Envelope in the wrong namespace", () => {
    expect(readSoapEnvelope(envelope("urn:not:soap", samlResponse))).toEqual({
      kind: "NotSoap",
    });
  });
});

describe("distinguishing what the body carries", () => {
  it("reports an envelope with no SAML", () => {
    expect(readSoapEnvelope(envelope(SOAP11, "<other/>"))).toEqual({
      kind: "WithoutSaml",
      version: "1.1",
    });
  });

  it("reports a 1.1 fault and its reason", () => {
    const fault = `<s:Fault xmlns:s="${SOAP11}"><faultcode>s:Server</faultcode><faultstring>boom</faultstring></s:Fault>`;

    expect(readSoapEnvelope(envelope(SOAP11, fault))).toEqual({
      kind: "Fault",
      version: "1.1",
      reason: "boom",
    });
  });

  it("reports a 1.2 fault and its reason", () => {
    const fault = `<s:Fault xmlns:s="${SOAP12}"><s:Reason><s:Text>bang</s:Text></s:Reason></s:Fault>`;

    expect(readSoapEnvelope(envelope(SOAP12, fault))).toEqual({
      kind: "Fault",
      version: "1.2",
      reason: "bang",
    });
  });

  it("accepts an Assertion as the body payload", () => {
    const assertion = `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_a1"/>`;

    expect(readSoapEnvelope(envelope(SOAP11, assertion))).toMatchObject({
      kind: "WithSaml",
      samlLocalName: "Assertion",
    });
  });
});

describe("putting an edited message back in its envelope", () => {
  it("replaces only the SAML element", () => {
    const original = envelope(SOAP11, samlResponse);
    const edited = `<samlp:Response xmlns:samlp="${PROTOCOL}" ID="_r2"><Extra/></samlp:Response>`;

    const outcome = buildSoapWithSaml(original, edited);
    if (outcome.kind !== "Ok") throw new Error("expected a rebuilt envelope");

    expect(outcome.xml).toContain("Envelope");
    expect(outcome.xml).toContain('ID="_r2"');
    expect(outcome.xml).toContain("<Extra/>");
    expect(outcome.xml).not.toContain('ID="_r1"');
  });

  it("preserves everything outside the body", () => {
    const withHeader = `<s:Envelope xmlns:s="${SOAP11}"><s:Header><Token>keep</Token></s:Header><s:Body>${samlResponse}</s:Body></s:Envelope>`;

    const outcome = buildSoapWithSaml(withHeader, samlResponse);
    if (outcome.kind !== "Ok") throw new Error("expected a rebuilt envelope");

    expect(outcome.xml).toContain("<Token>keep</Token>");
  });

  it("refuses when the original is not an envelope", () => {
    expect(buildSoapWithSaml(samlResponse, samlResponse)).toEqual({
      kind: "Failed",
      reason: "NotSoap",
    });
  });

  it("refuses when the envelope carries no SAML to replace", () => {
    expect(
      buildSoapWithSaml(envelope(SOAP11, "<other/>"), samlResponse),
    ).toEqual({ kind: "Failed", reason: "NoSamlBody" });
  });

  it("refuses a replacement that does not parse", () => {
    expect(
      buildSoapWithSaml(envelope(SOAP11, samlResponse), "<broken"),
    ).toEqual({ kind: "Failed", reason: "Unparseable" });
  });
});
