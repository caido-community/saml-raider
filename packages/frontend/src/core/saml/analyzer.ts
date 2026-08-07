import { type ParameterNames } from "shared";

import { readParameterNames } from "./parameterNames";
import { type SamlAnalysis } from "./types";

import { type ParameterSource } from "@/utils";
import {
  isPresent,
  readBody,
  readFormParameters,
  readHeader,
  readQueryString,
} from "@/utils";

const ASSERTION = /<[\w.-]*:?(?:Encrypted)?Assertion[\s/>]/;
const WS_FEDERATION_PARAMETER = "wresult";

const hasContentType = (raw: string, wanted: string): boolean => {
  const contentType = readHeader(raw, "content-type");
  return isPresent(contentType) && contentType.toLowerCase().includes(wanted);
};

export const analyzeSamlMessage = (
  raw: string,
  names: ParameterNames = readParameterNames(),
): SamlAnalysis => {
  if (hasContentType(raw, "xml")) {
    return ASSERTION.test(raw)
      ? { kind: "Soap" }
      : { kind: "XmlWithoutAssertion" };
  }

  const wsFederation = readFormParameters(
    raw,
    WS_FEDERATION_PARAMETER,
    "Body",
  )[0];
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
    const values = readFormParameters(raw, candidate.name, candidate.source);
    const value = values[0];

    if (isPresent(value)) {
      return {
        kind: "Parameter",
        name: candidate.name,
        value,
        source: candidate.source,
        isSamlRequest: candidate.isSamlRequest,
        isDuplicated: values.length > 1,
      };
    }
  }

  return readEmbedded(raw, names);
};

const readEmbedded = (raw: string, names: ParameterNames): SamlAnalysis => {
  const candidates: ReadonlyArray<{ name: string; isSamlRequest: boolean }> = [
    { name: names.samlResponse, isSamlRequest: false },
    { name: names.samlRequest, isSamlRequest: true },
  ];

  const scanned = `${readQueryString(raw)}\n${readBody(raw)}`;

  for (const candidate of candidates) {
    const at = scanned.indexOf(`${candidate.name}=`);
    if (at === -1) continue;

    const from = at + candidate.name.length + 1;
    const end = /[&"'<>\\\s]/.exec(scanned.slice(from))?.index;
    const value = scanned.slice(
      from,
      end === undefined ? undefined : from + end,
    );
    if (value === "") continue;

    return {
      kind: "Embedded",
      name: candidate.name,
      value,
      isSamlRequest: candidate.isSamlRequest,
    };
  }

  return { kind: "NotSaml" };
};

export const isSamlMessage = (analysis: SamlAnalysis): boolean => {
  switch (analysis.kind) {
    case "Soap":
    case "WsFederation":
    case "Parameter":
    case "Embedded":
      return true;

    case "NotSaml":
    case "XmlWithoutAssertion":
      return false;
  }
};
