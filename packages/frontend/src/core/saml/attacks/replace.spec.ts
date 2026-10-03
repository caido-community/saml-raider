// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { applyMatchAndReplace } from "./replace";

import { parseXml, serializeXml } from "@/core/saml/xml";

const DOC =
  '<r xmlns="urn:x" a="alice"><n>alice</n><n>alice smith</n><n>bob</n></r>';

const documentOf = (xml: string): Document => {
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") throw new Error("fixture did not parse");
  return parsed.document;
};

const run = (options: Parameters<typeof applyMatchAndReplace>[1]) =>
  applyMatchAndReplace(documentOf(DOC), options);

describe("the parity default: whole text nodes only", () => {
  it("replaces a text node whose entire content matches", () => {
    const outcome = run({
      mode: "ExactTextNode",
      search: "alice",
      replacement: "admin",
    });
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.matches).toBe(1);
    expect(outcome.xml).toContain("<n>admin</n>");
    expect(outcome.xml).toContain("<n>alice smith</n>");
  });

  it("leaves attribute values alone", () => {
    const outcome = run({
      mode: "ExactTextNode",
      search: "alice",
      replacement: "admin",
    });
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.xml).toContain('a="alice"');
  });

  it("reports zero matches rather than pretending it worked", () => {
    const outcome = run({
      mode: "ExactTextNode",
      search: "nobody",
      replacement: "admin",
    });
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.matches).toBe(0);
    expect(outcome.xml).toBe(serializeXml(documentOf(DOC)));
  });
});

describe("the explicit additions", () => {
  it("matches a substring only when asked", () => {
    const outcome = run({
      mode: "Substring",
      search: "alice",
      replacement: "admin",
    });
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.matches).toBe(2);
    expect(outcome.xml).toContain("<n>admin smith</n>");
  });

  it("matches a regular expression only when asked", () => {
    const outcome = run({
      mode: "RegularExpression",
      search: "^alice.*",
      replacement: "admin",
    });
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.matches).toBe(2);
  });

  it("matches attribute values only when asked", () => {
    const outcome = run({
      mode: "AttributeValue",
      search: "alice",
      replacement: "admin",
    });
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.matches).toBe(1);
    expect(outcome.xml).toContain('a="admin"');
    expect(outcome.xml).toContain("<n>alice</n>");
  });

  it("refuses an invalid regular expression instead of throwing", () => {
    expect(
      run({ mode: "RegularExpression", search: "(", replacement: "x" }),
    ).toStrictEqual({
      kind: "Refused",
      reason: "this is not a valid regular expression",
    });
  });

  it("refuses an empty search", () => {
    expect(
      run({ mode: "ExactTextNode", search: "", replacement: "x" }).kind,
    ).toBe("Refused");
  });
});

describe("escaping", () => {
  it("escapes a replacement that would otherwise inject markup", () => {
    const outcome = run({
      mode: "ExactTextNode",
      search: "bob",
      replacement: "<script>&</script>",
    });
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.xml).toContain("&lt;script&gt;&amp;&lt;/script&gt;");
    expect(parseXml(outcome.xml).kind).toBe("Ok");
  });

  it("escapes a replacement injected into an attribute", () => {
    const outcome = run({
      mode: "AttributeValue",
      search: "alice",
      replacement: '" onload="x',
    });
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(parseXml(outcome.xml).kind).toBe("Ok");
    expect(outcome.xml).not.toContain('onload="x"');
  });
});

describe("purity", () => {
  it("does not mutate the document it was given", () => {
    const document = documentOf(DOC);

    applyMatchAndReplace(document, {
      mode: "ExactTextNode",
      search: "alice",
      replacement: "admin",
    });

    expect(serializeXml(document)).toBe(serializeXml(documentOf(DOC)));
  });
});
