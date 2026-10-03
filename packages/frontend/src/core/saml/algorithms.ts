import { type SignatureAlgorithm } from "shared";

import { type Maybe } from "@/utils";

export const EXCLUSIVE_C14N_URI = "http://www.w3.org/2001/10/xml-exc-c14n#";

export const ENVELOPED_SIGNATURE_URI =
  "http://www.w3.org/2000/09/xmldsig#enveloped-signature";

const EXCLUSIVE_C14N_WITH_COMMENTS_URI =
  "http://www.w3.org/2001/10/xml-exc-c14n#WithComments";

export type Canonicalization = "Exclusive" | "ExclusiveWithComments";

const CANONICALIZATION_URIS: Record<Canonicalization, string> = {
  Exclusive: EXCLUSIVE_C14N_URI,
  ExclusiveWithComments: EXCLUSIVE_C14N_WITH_COMMENTS_URI,
};

const SIGNATURE_METHOD_URIS: Record<SignatureAlgorithm, string> = {
  "SHA-1": "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
  "SHA-256": "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
  "SHA-384": "http://www.w3.org/2001/04/xmldsig-more#rsa-sha384",
  "SHA-512": "http://www.w3.org/2001/04/xmldsig-more#rsa-sha512",
};

const DIGEST_METHOD_URIS: Record<SignatureAlgorithm, string> = {
  "SHA-1": "http://www.w3.org/2000/09/xmldsig#sha1",
  "SHA-256": "http://www.w3.org/2001/04/xmlenc#sha256",
  "SHA-384": "http://www.w3.org/2001/04/xmldsig-more#sha384",
  "SHA-512": "http://www.w3.org/2001/04/xmlenc#sha512",
};

const readByUri = <T extends string>(
  uris: Record<T, string>,
  uri: string,
): Maybe<T> => (Object.keys(uris) as T[]).find((key) => uris[key] === uri);

export const readSignatureMethodUri = (algorithm: SignatureAlgorithm): string =>
  SIGNATURE_METHOD_URIS[algorithm];

export const readDigestMethodUri = (algorithm: SignatureAlgorithm): string =>
  DIGEST_METHOD_URIS[algorithm];

export const readSignatureAlgorithm = (
  uri: string,
): Maybe<SignatureAlgorithm> => readByUri(SIGNATURE_METHOD_URIS, uri);

export const readDigestAlgorithm = (uri: string): Maybe<SignatureAlgorithm> =>
  readByUri(DIGEST_METHOD_URIS, uri);

export const readCanonicalization = (uri: string): Maybe<Canonicalization> =>
  readByUri(CANONICALIZATION_URIS, uri);
