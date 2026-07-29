import {
  type Compression,
  type DecodeFailure,
  type SamlAnalysis,
  type SamlMessageInfo,
} from "./saml";

export type MessageState =
  | { kind: "Idle" }
  | { kind: "NotSaml" }
  | {
      kind: "Decoded";
      analysis: SamlAnalysis;
      compression: Compression;
      xml: string;
      prettyXml: string;
      info: SamlMessageInfo;
    }
  | { kind: "DecodeFailed"; failure: DecodeFailure };
