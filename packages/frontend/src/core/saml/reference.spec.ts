// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  buildElementIdIndex,
  buildReferenceDigest,
  readElementById,
  readInclusivePrefixes,
  readReferenceId,
} from "./reference";
import { parseXml } from "./xml";

import { buildDigest } from "@/utils";

const documentOf = (xml: string): Document => {
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") throw new Error("fixture did not parse");
  return parsed.document;
};

const EMPTY = new Set<string>();

describe("indexing identifiers", () => {
  it("finds an element by its ID attribute", () => {
    const document = documentOf(`<r><a ID="_1"/><b ID="_2"/></r>`);
    const index = buildElementIdIndex(document);

    const first = readElementById(index, "_1");
    const second = readElementById(index, "_2");

    expect(first.kind === "Ok" && first.element.localName).toBe("a");
    expect(second.kind === "Ok" && second.element.localName).toBe("b");
  });

  it("reports a missing identifier rather than guessing", () => {
    const index = buildElementIdIndex(documentOf(`<r><a ID="_1"/></r>`));

    expect(readElementById(index, "_absent")).toEqual({ kind: "Missing" });
  });

  it("refuses a duplicated identifier instead of taking the first", () => {
    const index = buildElementIdIndex(
      documentOf(`<r><a ID="_dup"/><b ID="_dup"/></r>`),
    );

    expect(readElementById(index, "_dup")).toEqual({
      kind: "Ambiguous",
      count: 2,
    });
  });

  it("accepts the Id and id spellings identity providers use", () => {
    const index = buildElementIdIndex(
      documentOf(`<r><a Id="_lower"/><b id="_plain"/></r>`),
    );

    expect(readElementById(index, "_lower").kind).toBe("Ok");
    expect(readElementById(index, "_plain").kind).toBe("Ok");
  });

  it("ignores an empty identifier", () => {
    const index = buildElementIdIndex(documentOf(`<r><a ID=""/></r>`));

    expect(readElementById(index, "").kind).toBe("Missing");
  });
});

describe("reading a reference URI", () => {
  it("takes the fragment", () => {
    expect(readReferenceId("#_a1")).toBe("_a1");
  });

  it("refuses anything that is not a same-document fragment", () => {
    expect(readReferenceId("")).toBeUndefined();
    expect(readReferenceId("#")).toBeUndefined();
    expect(readReferenceId("https://example.com/doc#_a1")).toBeUndefined();
  });
});

describe("digesting a reference", () => {
  it("produces the SHA-256 of the canonical bytes", async () => {
    const document = documentOf(`<r ID="_1"><a>x</a></r>`);
    const element = document.documentElement;

    const digest = await buildReferenceDigest({
      element,
      omit: undefined,
      algorithm: "SHA-256",
      inclusivePrefixes: EMPTY,
    });

    const expected = await buildDigest(
      new TextEncoder().encode(`<r ID="_1"><a>x</a></r>`),
      "SHA-256",
    );
    expect(digest).toBe(expected);
  });

  it("excludes the signature the reference lives in", async () => {
    const document = documentOf(
      `<r ID="_1"><a>x</a><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><v>ignored</v></Signature></r>`,
    );
    const signature = document.getElementsByTagNameNS(
      "http://www.w3.org/2000/09/xmldsig#",
      "Signature",
    )[0];

    const digest = await buildReferenceDigest({
      element: document.documentElement,
      omit: signature,
      algorithm: "SHA-256",
      inclusivePrefixes: EMPTY,
    });

    const expected = await buildDigest(
      new TextEncoder().encode(`<r ID="_1"><a>x</a></r>`),
      "SHA-256",
    );
    expect(digest).toBe(expected);
  });

  it("changes when the covered content changes", async () => {
    const build = (text: string) =>
      buildReferenceDigest({
        element: documentOf(`<r><a>${text}</a></r>`).documentElement,
        omit: undefined,
        algorithm: "SHA-256",
        inclusivePrefixes: EMPTY,
      });

    expect(await build("x")).not.toBe(await build("y"));
  });
});

describe("reading an inclusive prefix list", () => {
  it("splits the list and maps #default to the default namespace", () => {
    const document = documentOf(
      `<Transform xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#"><ec:InclusiveNamespaces PrefixList="#default saml ds"/></Transform>`,
    );

    expect([...readInclusivePrefixes(document.documentElement)]).toEqual([
      "",
      "saml",
      "ds",
    ]);
  });

  it("is empty when the transform carries no list", () => {
    const document = documentOf(`<Transform/>`);

    expect(readInclusivePrefixes(document.documentElement).size).toBe(0);
  });
});
