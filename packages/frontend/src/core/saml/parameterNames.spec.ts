import { DEFAULT_PARAMETER_NAMES } from "shared";
import { afterEach, describe, expect, it } from "vitest";

import { analyzeSamlMessage } from "./analyzer";
import { applyParameterNames, readParameterNames } from "./parameterNames";

import { buildRawRequest, FORM_CONTENT_TYPE } from "@/tests/fixtures";

afterEach(() => applyParameterNames(DEFAULT_PARAMETER_NAMES));

const request = (body: string) =>
  buildRawRequest("POST /sso HTTP/1.1", [FORM_CONTENT_TYPE], body);

describe("defaults", () => {
  it("starts on the protocol names", () => {
    expect(readParameterNames()).toEqual({
      samlRequest: "SAMLRequest",
      samlResponse: "SAMLResponse",
    });
  });
});

describe("configured names", () => {
  it("detects a message under a custom parameter name", () => {
    applyParameterNames({ samlRequest: "req", samlResponse: "resp" });

    const analysis = analyzeSamlMessage(request("resp=PHNhbWw%2B"));

    expect(analysis).toMatchObject({ kind: "Parameter", name: "resp" });
  });

  it("stops detecting the default name once it is replaced", () => {
    applyParameterNames({ samlRequest: "req", samlResponse: "resp" });

    expect(analyzeSamlMessage(request("SAMLResponse=PHNhbWw%2B")).kind).toBe(
      "NotSaml",
    );
  });

  it("is case sensitive, because a form parameter is", () => {
    applyParameterNames({
      samlRequest: "samlrequest",
      samlResponse: "samlresponse",
    });

    expect(analyzeSamlMessage(request("SAMLResponse=PHNhbWw%2B")).kind).toBe(
      "NotSaml",
    );
    expect(analyzeSamlMessage(request("samlresponse=PHNhbWw%2B")).kind).toBe(
      "Parameter",
    );
  });

  it("still lets a caller pass names explicitly", () => {
    applyParameterNames({ samlRequest: "req", samlResponse: "resp" });

    const analysis = analyzeSamlMessage(request("other=PHNhbWw%2B"), {
      samlRequest: "ignored",
      samlResponse: "other",
    });

    expect(analysis).toMatchObject({ kind: "Parameter", name: "other" });
  });
});
