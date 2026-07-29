import { type ParameterNames, type SamlAnalysis } from "@/types";
import {
  isPresent,
  type ParameterSource,
  readFormParameter,
  readHeader,
} from "@/utils";

const DEFAULT_PARAMETER_NAMES: ParameterNames = {
  samlRequest: "SAMLRequest",
  samlResponse: "SAMLResponse",
};

const ASSERTION = /<[\w.-]*:?(?:Encrypted)?Assertion[\s/>]/;
const WS_FEDERATION_PARAMETER = "wresult";

const hasContentType = (raw: string, wanted: string): boolean => {
  const contentType = readHeader(raw, "content-type");
  return isPresent(contentType) && contentType.toLowerCase().includes(wanted);
};

export const analyzeSamlMessage = (
  raw: string,
  names: ParameterNames = DEFAULT_PARAMETER_NAMES,
): SamlAnalysis => {
  if (hasContentType(raw, "xml")) {
    return ASSERTION.test(raw)
      ? { kind: "Soap" }
      : { kind: "XmlWithoutAssertion" };
  }

  const wsFederation = readFormParameter(raw, WS_FEDERATION_PARAMETER, "Body");
  if (isPresent(wsFederation)) {
    return {
      kind: "WsFederation",
      value: wsFederation,
      isUrlEncoded: hasContentType(raw, "application/x-www-form-urlencoded"),
    };
  }

  const searchOrder: ReadonlyArray<{
    name: string;
    source: ParameterSource;
    isSamlRequest: boolean;
  }> = [
    { name: names.samlResponse, source: "Body", isSamlRequest: false },
    { name: names.samlResponse, source: "Query", isSamlRequest: false },
    { name: names.samlRequest, source: "Body", isSamlRequest: true },
    { name: names.samlRequest, source: "Query", isSamlRequest: true },
  ];

  for (const candidate of searchOrder) {
    const value = readFormParameter(raw, candidate.name, candidate.source);
    if (isPresent(value)) {
      return {
        kind: "Parameter",
        name: candidate.name,
        value,
        source: candidate.source,
        isSamlRequest: candidate.isSamlRequest,
      };
    }
  }

  return { kind: "NotSaml" };
};

export const isLikelySamlMessage = (
  raw: string,
  names: ParameterNames = DEFAULT_PARAMETER_NAMES,
): boolean =>
  raw.includes(names.samlRequest) ||
  raw.includes(names.samlResponse) ||
  raw.includes(WS_FEDERATION_PARAMETER) ||
  ASSERTION.test(raw);
