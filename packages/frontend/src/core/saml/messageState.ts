import { readMessageInfo } from "./messageInfo";
import { prettyPrintForDisplay } from "./pretty";
import {
  type Compression,
  type DecodeFailure,
  type DecodeOutcome,
  type SamlAnalysis,
  type SamlMessageInfo,
} from "./types";
import { parseXml } from "./xml";

export type MessageState =
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

const buildDecodedState = (
  analysis: SamlAnalysis,
  outcome: DecodeOutcome,
): MessageState => {
  switch (outcome.kind) {
    case "Failed":
      return { kind: "DecodeFailed", failure: outcome.failure };

    case "Ok": {
      const parsed = parseXml(outcome.value.xml);

      switch (parsed.kind) {
        case "Malformed":
          return {
            kind: "DecodeFailed",
            failure: { kind: "MalformedXml", message: parsed.message },
          };

        case "DoctypeRejected":
          return {
            kind: "DecodeFailed",
            failure: { kind: "DoctypeRejected", name: parsed.name },
          };

        case "Ok":
          return {
            kind: "Decoded",
            analysis,
            compression: outcome.value.compression,
            xml: outcome.value.xml,
            prettyXml: prettyPrintForDisplay(parsed.document),
            info: readMessageInfo(parsed.document),
          };
      }
    }
  }
};

export const buildMessageState = (
  analysis: SamlAnalysis,
  outcome: DecodeOutcome,
): MessageState => {
  switch (analysis.kind) {
    case "NotSaml":
    case "XmlWithoutAssertion":
      return { kind: "NotSaml" };

    case "Soap":
    case "WsFederation":
    case "Parameter":
    case "Embedded":
      return buildDecodedState(analysis, outcome);
  }
};
