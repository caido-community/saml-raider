import { decodeSamlParameter } from "./codec";

import { type DecodeOutcome, type SamlAnalysis } from "@/types";
import { readBody } from "@/utils";

const buildUncompressedOutcome = (xml: string): DecodeOutcome => ({
  kind: "Ok",
  value: { xml, compression: "None" },
});

export const decodeMessage = async (
  raw: string,
  analysis: SamlAnalysis,
): Promise<DecodeOutcome> => {
  switch (analysis.kind) {
    case "Soap":
      return buildUncompressedOutcome(readBody(raw));

    case "WsFederation":
      return buildUncompressedOutcome(
        analysis.isUrlEncoded
          ? decodeURIComponent(analysis.value)
          : analysis.value,
      );

    case "Parameter":
      return decodeSamlParameter(analysis.value);

    case "NotSaml":
    case "XmlWithoutAssertion":
      return { kind: "Failed", failure: { kind: "NotSaml" } };
  }
};
