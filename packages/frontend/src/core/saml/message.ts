import { decodeSamlParameter } from "./codec";
import { type DecodeOutcome, type SamlAnalysis } from "./types";

import { decodeUri, isAbsent, readBody } from "@/utils";

const buildUncompressedOutcome = (xml: string): DecodeOutcome => ({
  kind: "Ok",
  value: { xml, compression: "None" },
});

const decodeWsFederation = (
  value: string,
  isUrlEncoded: boolean,
): DecodeOutcome => {
  if (!isUrlEncoded) return buildUncompressedOutcome(value);

  const unescaped = decodeUri(value);
  if (isAbsent(unescaped)) {
    return { kind: "Failed", failure: { kind: "MalformedUrlEncoding" } };
  }

  return buildUncompressedOutcome(unescaped);
};

export const decodeMessage = (
  raw: string,
  analysis: SamlAnalysis,
): DecodeOutcome => {
  switch (analysis.kind) {
    case "Soap":
      return buildUncompressedOutcome(readBody(raw));

    case "WsFederation":
      return decodeWsFederation(analysis.value, analysis.isUrlEncoded);

    case "Parameter":
      return decodeSamlParameter(analysis.value);

    case "NotSaml":
    case "XmlWithoutAssertion":
      return { kind: "Failed", failure: { kind: "NotSaml" } };
  }
};
