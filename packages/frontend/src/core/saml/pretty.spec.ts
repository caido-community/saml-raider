import { describe, expect, it } from "vitest";

import { prettyPrintForDisplay } from "./pretty";

describe("prettyPrintForDisplay", () => {
  it("indents nested elements", () => {
    const output = prettyPrintForDisplay("<a><b><c>v</c></b></a>");

    expect(output).toBe(
      ["<a>", "  <b>", "    <c>v</c>", "  </b>", "</a>"].join("\n"),
    );
  });

  it("keeps a leaf with text on one line", () => {
    expect(prettyPrintForDisplay("<Issuer>https://idp</Issuer>")).toBe(
      "<Issuer>https://idp</Issuer>",
    );
  });

  it("does not indent past a self-closing element", () => {
    const output = prettyPrintForDisplay("<a><b/><c/></a>");

    expect(output).toBe(["<a>", "  <b/>", "  <c/>", "</a>"].join("\n"));
  });

  it("handles the xml declaration", () => {
    const output = prettyPrintForDisplay('<?xml version="1.0"?><a><b/></a>');

    expect(output).toBe(
      ['<?xml version="1.0"?>', "<a>", "  <b/>", "</a>"].join("\n"),
    );
  });

  it("preserves attributes", () => {
    const output = prettyPrintForDisplay(
      '<a xmlns:s="urn:x"><s:B id="1">v</s:B></a>',
    );

    expect(output).toContain('xmlns:s="urn:x"');
    expect(output).toContain('<s:B id="1">v</s:B>');
  });

  it("is not safe to re-sign, because it changes the bytes", () => {
    const signed = "<Assertion><Signature>abc</Signature></Assertion>";

    expect(prettyPrintForDisplay(signed)).not.toBe(signed);
  });
});

describe("mismatched tags", () => {
  it("does not treat a line whose closing tag differs as self-contained", () => {
    const output = prettyPrintForDisplay("<r><a>text</b><c/></r>");

    expect(output.split("\n")[1]).toBe("  <a>text</b>");
    expect(output.split("\n")[2]).toBe("    <c/>");
  });
});
