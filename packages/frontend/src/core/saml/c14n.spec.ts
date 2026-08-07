// @vitest-environment jsdom
import { readdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { describe, expect, it } from "vitest";

import { toCanonicalXml } from "./c14n";
import { parseXml } from "./xml";

const CORPUS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/c14n",
);

const EXCLUSIVE = { withComments: false, inclusivePrefixes: new Set<string>() };

const names = readdirSync(CORPUS)
  .filter((name) => name.endsWith(".xml"))
  .sort();

const readFixture = (name: string) => {
  const xml = readFileSync(join(CORPUS, name), "utf8");
  const golden = readFileSync(
    join(CORPUS, name.replace(/\.xml$/, ".exc")),
    "utf8",
  );
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") throw new Error(`${name} did not parse`);
  return { golden, document: parsed.document };
};

const commentFree = names.filter((name) => !name.includes("comments"));

describe("exclusive canonicalization matches libxml2", () => {
  it("has a golden for every fixture", () => {
    expect(names.length).toBeGreaterThan(10);
    for (const name of names) expect(() => readFixture(name)).not.toThrow();
  });

  it.each(commentFree)("%s", (name) => {
    const { golden, document } = readFixture(name);

    expect(toCanonicalXml(document.documentElement, EXCLUSIVE)).toBe(golden);
  });
});

describe("comments", () => {
  it("keeps them only when asked", () => {
    const { golden, document } = readFixture("14-comments.xml");

    expect(
      toCanonicalXml(document.documentElement, {
        withComments: true,
        inclusivePrefixes: new Set<string>(),
      }),
    ).toBe(golden);
    expect(toCanonicalXml(document.documentElement, EXCLUSIVE)).toBe(
      "<r><a></a>text</r>",
    );
  });
});

describe("elements built in memory rather than parsed", () => {
  const XML_DSIG = "http://www.w3.org/2000/09/xmldsig#";

  it("declares a prefix the apex uses even with no xmlns attribute node", () => {
    const owner = new DOMParser().parseFromString("<r/>", "application/xml");
    const signature = owner.createElementNS(XML_DSIG, "ds:Signature");
    const signedInfo = owner.createElementNS(XML_DSIG, "ds:SignedInfo");
    signature.appendChild(signedInfo);

    expect(
      signedInfo.getAttributeNS("http://www.w3.org/2000/xmlns/", "ds"),
    ).toBe(null);
    expect(toCanonicalXml(signedInfo, EXCLUSIVE)).toBe(
      `<ds:SignedInfo xmlns:ds="${XML_DSIG}"></ds:SignedInfo>`,
    );
  });

  it("canonicalizes a constructed element the same as the parsed one", () => {
    const owner = new DOMParser().parseFromString("<r/>", "application/xml");
    const built = owner.createElementNS(XML_DSIG, "ds:SignedInfo");
    owner.documentElement.appendChild(built);

    const parsed = parseXml(
      `<ds:SignedInfo xmlns:ds="${XML_DSIG}"></ds:SignedInfo>`,
    );
    if (parsed.kind !== "Ok") throw new Error("did not parse");

    expect(toCanonicalXml(built, EXCLUSIVE)).toBe(
      toCanonicalXml(parsed.document.documentElement, EXCLUSIVE),
    );
  });
});
