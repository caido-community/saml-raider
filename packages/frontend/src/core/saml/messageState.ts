import { prettyPrintForDisplay } from "./pretty";
import { parseXml, readMessageInfo } from "./xml";

import {
  type DecodeOutcome,
  type MessageState,
  type SamlAnalysis,
} from "@/types";

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

        case "Ok":
          return {
            kind: "Decoded",
            analysis,
            compression: outcome.value.compression,
            xml: outcome.value.xml,
            prettyXml: prettyPrintForDisplay(outcome.value.xml),
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
      return buildDecodedState(analysis, outcome);
  }
};
