import { type Maybe, type ParameterSource } from "@/utils";

export type Compression = "None" | "Gzip" | "Deflate";

type DecodedParameter = {
  xml: string;
  compression: Compression;
};

export type DecodeFailure =
  | { kind: "InvalidBase64" }
  | { kind: "DecompressionFailed" }
  | { kind: "NotSaml" }
  | { kind: "MalformedXml"; message: string };

export type DecodeOutcome =
  | { kind: "Ok"; value: DecodedParameter }
  | { kind: "Failed"; failure: DecodeFailure };

export type ParameterNames = {
  samlRequest: string;
  samlResponse: string;
};

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
    };

export type ParsedDocument =
  { kind: "Ok"; document: Document } | { kind: "Malformed"; message: string };

export type SamlMessageInfo = {
  issuer: Maybe<string>;
  conditionNotBefore: Maybe<string>;
  conditionNotAfter: Maybe<string>;
  subject: Maybe<string>;
  subjectConfirmationNotBefore: Maybe<string>;
  subjectConfirmationNotAfter: Maybe<string>;
  signatureAlgorithm: Maybe<string>;
  digestAlgorithm: Maybe<string>;
  encryptionMethod: Maybe<string>;
  certificate: Maybe<string>;
};
