const PROTOCOL = 'xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"';

const ASSERTION = 'xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"';

const DS = 'xmlns:ds="http://www.w3.org/2000/09/xmldsig#"';

const signature = (uri: string, digest = "PLACEHOLDER") =>
  `<ds:Signature ${DS}><ds:SignedInfo>` +
  `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
  `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
  `<ds:Reference URI="${uri}"><ds:Transforms>` +
  `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
  `<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
  `</ds:Transforms>` +
  `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
  `<ds:DigestValue>${digest}</ds:DigestValue></ds:Reference></ds:SignedInfo>` +
  `<ds:SignatureValue>c2ln</ds:SignatureValue>` +
  `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>MIIBfake</ds:X509Certificate></ds:X509Data></ds:KeyInfo>` +
  `</ds:Signature>`;

const assertion = (id: string, subject: string) =>
  `<saml:Assertion ${ASSERTION} ID="${id}"><saml:Subject><saml:NameID>${subject}</saml:NameID></saml:Subject></saml:Assertion>`;

const response = (body: string) =>
  `<samlp:Response ${PROTOCOL} ${ASSERTION} ID="_r1"><saml:Issuer>https://idp.example.com</saml:Issuer>${body}</samlp:Response>`;

export const UNWRAPPED = response(
  `${signature("#_a1")}${assertion("_a1", "bob@example.com")}`,
);

export const DUPLICATE_ID = response(
  `${signature("#_a1")}${assertion("_a1", "bob@example.com")}${assertion("_a1", "admin@example.com")}`,
);

export const EVIL_SIBLING_FIRST = response(
  `${signature("#_a1")}${assertion("_evil", "admin@example.com")}${assertion("_a1", "bob@example.com")}`,
);

export const EVIL_PARENT = response(
  `${signature("#_a1")}<saml:Assertion ${ASSERTION} ID="_evil"><saml:Subject><saml:NameID>admin@example.com</saml:NameID></saml:Subject>${assertion("_a1", "bob@example.com")}</saml:Assertion>`,
);

export const ORIGINAL_INSIDE_SIGNATURE = response(
  `<ds:Signature ${DS}><ds:Object>${assertion("_a1", "bob@example.com")}</ds:Object></ds:Signature>${assertion("_evil", "admin@example.com")}`,
);

export const WRAPPED_IN_EXTENSIONS = response(
  `${signature("#_a1")}<samlp:Extensions>${assertion("_a1", "bob@example.com")}</samlp:Extensions>${assertion("_evil", "admin@example.com")}`,
);

export const REFERENCE_TO_NOTHING = response(
  `${signature("#_gone")}${assertion("_a1", "bob@example.com")}`,
);
