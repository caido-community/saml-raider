import { type Maybe, type ParameterSource } from "@/utils";

export type Compression = "None" | "Gzip" | "Deflate";

type DecodedParameter = {
  xml: string;
  compression: Compression;
};

export type DecodeFailure =
  | { kind: "MalformedUrlEncoding" }
  | { kind: "InvalidBase64" }
  | { kind: "DecompressionFailed" }
  | { kind: "TooLarge" }
  | { kind: "NotSaml" }
  | { kind: "MalformedXml"; message: string }
  | { kind: "DoctypeRejected"; name: string };

export type DecodeOutcome =
  | { kind: "Ok"; value: DecodedParameter }
  | { kind: "Failed"; failure: DecodeFailure };

export type SamlAnalysis =
  | { kind: "NotSaml" }
  | { kind: "XmlWithoutAssertion" }
  | { kind: "Soap" }
  | { kind: "WsFederation"; value: string; isUrlEncoded: boolean }
  | {
      kind: "Parameter";
      name: string;
      value: string;
      source: ParameterSource;
      isSamlRequest: boolean;
      isDuplicated: boolean;
    };

export type ParsedDocument =
  | { kind: "Ok"; document: Document }
  | { kind: "Malformed"; message: string }
  | { kind: "DoctypeRejected"; name: string };

export type SamlMessageKind =
  | "Response"
  | "AuthnRequest"
  | "LogoutRequest"
  | "LogoutResponse"
  | "ArtifactResolve"
  | "ArtifactResponse"
  | "AttributeQuery"
  | "Unknown";

export type SignedElement = {
  element: string;
  id: Maybe<string>;
};

export type SamlMessageInfo = {
  kind: SamlMessageKind;
  id: Maybe<string>;
  inResponseTo: Maybe<string>;
  destination: Maybe<string>;
  issueInstant: Maybe<string>;
  statusCode: Maybe<string>;
  issuer: Maybe<string>;
  conditionNotBefore: Maybe<string>;
  conditionNotAfter: Maybe<string>;
  subject: Maybe<string>;
  subjectConfirmationNotBefore: Maybe<string>;
  subjectConfirmationNotAfter: Maybe<string>;
  signatureAlgorithm: Maybe<string>;
  digestAlgorithm: Maybe<string>;
  encryptionMethod: Maybe<string>;
  certificates: string[];
  assertionCount: number;
  encryptedAssertionCount: number;
  signedElements: SignedElement[];
  hasDuplicateIds: boolean;
};
