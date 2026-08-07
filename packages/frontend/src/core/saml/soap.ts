import { SAML_ASSERTION_NS, SAML_PROTOCOL_NS } from "./namespaces";
import { parseXml, readAllElements, serializeXml } from "./xml";

import { isAbsent, type Maybe } from "@/utils";

const SOAP_11_NS = "http://schemas.xmlsoap.org/soap/envelope/";

const SOAP_12_NS = "http://www.w3.org/2003/05/soap-envelope";

type SoapVersion = "1.1" | "1.2";

export type SoapEnvelope =
  | { kind: "NotSoap" }
  | { kind: "Fault"; version: SoapVersion; reason: string }
  | { kind: "WithoutSaml"; version: SoapVersion }
  | {
      kind: "WithSaml";
      version: SoapVersion;
      document: Document;
      samlLocalName: string;
    };

const readVersion = (root: Element): Maybe<SoapVersion> => {
  if (root.localName !== "Envelope") return undefined;
  if (root.namespaceURI === SOAP_11_NS) return "1.1";
  if (root.namespaceURI === SOAP_12_NS) return "1.2";
  return undefined;
};

const isSamlRoot = (element: Element): boolean =>
  (element.namespaceURI === SAML_PROTOCOL_NS &&
    (element.localName === "Response" ||
      element.localName === "AuthnRequest" ||
      element.localName === "LogoutRequest" ||
      element.localName === "LogoutResponse" ||
      element.localName === "ArtifactResponse")) ||
  (element.namespaceURI === SAML_ASSERTION_NS &&
    element.localName === "Assertion");

const readFaultReason = (body: Element, version: SoapVersion): string => {
  const wanted = version === "1.1" ? "faultstring" : "Text";
  const reason = readAllElements(body).find(
    (element) => element.localName === wanted,
  );
  return reason?.textContent?.trim() ?? "";
};

export const readSoapEnvelope = (xml: string): SoapEnvelope => {
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") return { kind: "NotSoap" };

  const root = parsed.document.documentElement;
  const version = readVersion(root);
  if (isAbsent(version)) return { kind: "NotSoap" };

  const body = Array.from(root.children).find(
    (child) =>
      child.namespaceURI === root.namespaceURI && child.localName === "Body",
  );
  if (isAbsent(body)) return { kind: "WithoutSaml", version };

  const fault = Array.from(body.children).find(
    (child) =>
      child.namespaceURI === root.namespaceURI && child.localName === "Fault",
  );
  if (!isAbsent(fault)) {
    return { kind: "Fault", version, reason: readFaultReason(fault, version) };
  }

  const saml = Array.from(body.children).find(isSamlRoot);
  if (isAbsent(saml)) return { kind: "WithoutSaml", version };

  return {
    kind: "WithSaml",
    version,
    document: parsed.document,
    samlLocalName: saml.localName,
  };
};

export type SoapReplacement =
  | { kind: "Ok"; xml: string }
  | { kind: "Failed"; reason: "NotSoap" | "NoSamlBody" | "Unparseable" };

export const buildSoapWithSaml = (
  envelopeXml: string,
  samlXml: string,
): SoapReplacement => {
  const envelope = readSoapEnvelope(envelopeXml);
  if (envelope.kind === "NotSoap") return { kind: "Failed", reason: "NotSoap" };
  if (envelope.kind !== "WithSaml") {
    return { kind: "Failed", reason: "NoSamlBody" };
  }

  const replacement = parseXml(samlXml);
  if (replacement.kind !== "Ok") {
    return { kind: "Failed", reason: "Unparseable" };
  }

  const root = envelope.document.documentElement;
  const body = Array.from(root.children).find(
    (child) =>
      child.namespaceURI === root.namespaceURI && child.localName === "Body",
  );
  if (isAbsent(body)) return { kind: "Failed", reason: "NoSamlBody" };

  const existing = Array.from(body.children).find(isSamlRoot);
  if (isAbsent(existing)) return { kind: "Failed", reason: "NoSamlBody" };

  body.replaceChild(
    envelope.document.importNode(replacement.document.documentElement, true),
    existing,
  );

  return { kind: "Ok", xml: serializeXml(envelope.document) };
};

export const readSoapSaml = (xml: string): Maybe<string> => {
  const envelope = readSoapEnvelope(xml);
  if (envelope.kind !== "WithSaml") return undefined;

  const root = envelope.document.documentElement;
  const body = Array.from(root.children).find(
    (child) =>
      child.namespaceURI === root.namespaceURI && child.localName === "Body",
  );
  if (isAbsent(body)) return undefined;

  const saml = Array.from(body.children).find(isSamlRoot);
  return isAbsent(saml) ? undefined : serializeXml(saml);
};
