import { parseXml, readMessageInfo } from "@/core";
import { type SamlMessageInfo } from "@/core";

export const SAML_RESPONSE = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" ID="_r1"><saml:Issuer>https://idp.example.com</saml:Issuer><ds:Signature><ds:SignedInfo><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><ds:Reference URI="#_a1"><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/></ds:Reference></ds:SignedInfo><ds:KeyInfo><ds:X509Data><ds:X509Certificate>MIIC-base64</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Assertion ID="_a1"><saml:Subject><saml:NameID>alice@example.com</saml:NameID><saml:SubjectConfirmation><saml:SubjectConfirmationData NotBefore="2026-01-01T00:00:00Z" NotOnOrAfter="2026-01-01T01:00:00Z"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2026-01-01T00:00:00Z" NotOnOrAfter="2026-01-01T02:00:00Z"/></saml:Assertion></samlp:Response>`;

export const MINIMAL_RESPONSE = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Issuer>https://idp.example.com</saml:Issuer><saml:Assertion ID="_a1"><saml:Subject><saml:NameID>alice@example.com</saml:NameID></saml:Subject></saml:Assertion></samlp:Response>`;

export const FORM_CONTENT_TYPE =
  "Content-Type: application/x-www-form-urlencoded";

export const XML_CONTENT_TYPE = "Content-Type: text/xml; charset=utf-8";

export const buildRawRequest = (
  line: string,
  headers: string[],
  body = "",
): string => [line, ...headers, "", body].join("\r\n");

export const buildMessageInfo = (xml: string): SamlMessageInfo => {
  const outcome = parseXml(xml);
  if (outcome.kind !== "Ok") {
    throw new Error(`expected a parseable fixture, received ${outcome.kind}`);
  }

  return readMessageInfo(outcome.document);
};

export const ADFS_SHAPED_RESPONSE = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns="urn:oasis:names:tc:SAML:2.0:assertion" ID="_adfs1" InResponseTo="_req1" Version="2.0" IssueInstant="2026-01-01T00:00:00Z" Destination="https://sp.example.com/acs"><Issuer>http://adfs.example.com/adfs/services/trust</Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status><Assertion ID="_adfsA1" IssueInstant="2026-01-01T00:00:00Z" Version="2.0"><Issuer>http://adfs.example.com/adfs/services/trust</Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><ds:Reference URI="#_adfsA1"><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/></ds:Reference></ds:SignedInfo></ds:Signature><Subject><NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">bob@example.com</NameID><SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><SubjectConfirmationData NotOnOrAfter="2026-01-01T00:05:00Z" Recipient="https://sp.example.com/acs"/></SubjectConfirmation></Subject><Conditions NotBefore="2026-01-01T00:00:00Z" NotOnOrAfter="2026-01-01T01:00:00Z"/></Assertion></samlp:Response>`;

export const SHIBBOLETH_SHAPED_RESPONSE = `<saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" ID="_shib1" InResponseTo="_req2" IssueInstant="2026-01-01T00:00:00Z" Destination="https://sp.example.com/acs" Version="2.0"><saml2:Issuer>https://samltest.id/saml/idp</saml2:Issuer><saml2p:Status><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></saml2p:Status><saml2:EncryptedAssertion><xenc:EncryptedData xmlns:xenc="http://www.w3.org/2001/04/xmlenc#" Type="http://www.w3.org/2001/04/xmlenc#Element"><xenc:EncryptionMethod Algorithm="http://www.w3.org/2009/xmlenc11#aes256-gcm"/></xenc:EncryptedData></saml2:EncryptedAssertion></saml2p:Response>`;

export const LOGOUT_REQUEST = `<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_lo1" IssueInstant="2026-01-01T00:00:00Z" Destination="https://idp.example.com/slo" Version="2.0"><saml:Issuer>https://sp.example.com</saml:Issuer><saml:NameID>carol@example.com</saml:NameID><samlp:SessionIndex>_sess1</samlp:SessionIndex></samlp:LogoutRequest>`;
