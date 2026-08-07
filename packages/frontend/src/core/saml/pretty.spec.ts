// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { prettyPrintForDisplay } from "./pretty";
import { parseXml } from "./xml";

const pretty = (xml: string): string => {
  const outcome = parseXml(xml);
  if (outcome.kind !== "Ok") {
    throw new Error(`expected Ok, received ${outcome.kind}`);
  }
  return prettyPrintForDisplay(outcome.document);
};

describe("indentation", () => {
  it("indents nested elements", () => {
    expect(pretty("<a><b><c>v</c></b></a>")).toBe(
      ["<a>", "  <b>", "    <c>v</c>", "  </b>", "</a>"].join("\n"),
    );
  });

  it("keeps a leaf with text on one line", () => {
    expect(pretty("<Issuer>https://idp</Issuer>")).toBe(
      "<Issuer>https://idp</Issuer>",
    );
  });

  it("does not indent past a self-closing element", () => {
    expect(pretty("<a><b/><c/></a>")).toBe(
      ["<a>", "  <b/>", "  <c/>", "</a>"].join("\n"),
    );
  });

  it("preserves attributes and prefixes", () => {
    const output = pretty('<a xmlns:s="urn:x"><s:B id="1">v</s:B></a>');

    expect(output).toContain('xmlns:s="urn:x"');
    expect(output).toContain('<s:B id="1">v</s:B>');
  });
});

describe("content the regex printer used to corrupt", () => {
  it("does not inject whitespace inside CDATA", () => {
    expect(pretty("<a><![CDATA[  keep   spacing  ]]></a>")).toContain(
      "  keep   spacing  ",
    );
  });

  it("keeps text that merely looks like markup as text", () => {
    expect(pretty("<a><![CDATA[<not>a tag</not>]]></a>")).toContain(
      "<not>a tag</not>",
    );
  });

  it("keeps both halves of mixed content", () => {
    const output = pretty("<p>before<b>bold</b>after</p>");

    expect(output).toContain("before");
    expect(output).toContain("after");
    expect(output).toContain("<b>bold</b>");
  });
});

describe("safety", () => {
  it("is not byte-identical to the source, which is why it is never re-signed", () => {
    const source = "<Assertion><Signature>abc</Signature></Assertion>";

    expect(pretty(source)).not.toBe(source);
  });

  it("changes offsets, so analyser offsets never apply to it", () => {
    const source = `<Response ID="_r1"><Assertion ID="_a1"><Issuer>idp</Issuer></Assertion></Response>`;

    expect(pretty(source).indexOf("<Issuer>")).not.toBe(
      source.indexOf("<Issuer>"),
    );
  });
});
