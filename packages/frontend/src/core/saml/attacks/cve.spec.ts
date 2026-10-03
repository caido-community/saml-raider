// @vitest-environment jsdom
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { describe, expect, it } from "vitest";

import { applyCvePreset, CVE_PRESETS, type CveId } from "./cve";

import { readSignatures } from "@/core/saml/verify";
import { parseXml, serializeXml } from "@/core/saml/xml";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (name: string) =>
  readFileSync(join(HERE, "../../../tests/signing", name), "utf8");

const ASSERTION_SIGNED = read("signed-by-us.xml");
const RESPONSE_SIGNED = read("signed-response-by-us.xml");

const documentOf = (xml: string): Document => {
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") throw new Error("fixture did not parse");
  return parsed.document;
};

const ids = CVE_PRESETS.map((preset) => preset.id);

describe("what each preset tells the user before they run it", () => {
  it("names every preset with a product and a reference", () => {
    expect(CVE_PRESETS.length).toBeGreaterThanOrEqual(7);

    for (const preset of CVE_PRESETS) {
      expect(preset.product).not.toBe("");
      expect(preset.summary).not.toBe("");
      expect(preset.reference.startsWith("https://")).toBe(true);
    }
  });

  it("uses each identifier exactly once", () => {
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("purity", () => {
  it.each(ids)("%s does not mutate the document it was given", (id) => {
    const document = documentOf(ASSERTION_SIGNED);

    applyCvePreset(document, id);

    expect(serializeXml(document)).toBe(ASSERTION_SIGNED);
  });

  it.each(ids)("%s refuses a message that is not a SAML Response", (id) => {
    expect(applyCvePreset(documentOf("<a/>"), id)).toStrictEqual({
      kind: "NotApplicable",
      reason: "this message is not a SAML Response",
    });
  });
});

describe("the extra unsigned assertion preset", () => {
  it("appends a second assertion that carries no signature", () => {
    const outcome = applyCvePreset(
      documentOf(ASSERTION_SIGNED),
      "CVE-2022-41912",
    );
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    const document = documentOf(outcome.xml);
    const assertions = Array.from(
      document.getElementsByTagNameNS(
        "urn:oasis:names:tc:SAML:2.0:assertion",
        "Assertion",
      ),
    );

    expect(assertions).toHaveLength(2);
    expect(assertions[1]?.getAttribute("ID")).toBe("_cve_2022_41912");
    expect(
      assertions[1]?.getElementsByTagNameNS(
        "http://www.w3.org/2000/09/xmldsig#",
        "Signature",
      ),
    ).toHaveLength(0);
  });

  it("refuses to claim the target is vulnerable", () => {
    const outcome = applyCvePreset(
      documentOf(ASSERTION_SIGNED),
      "CVE-2022-41912",
    );
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.effect).toContain("proves nothing");
  });
});

describe("the response wrapping preset", () => {
  it("needs a signature over the Response", () => {
    expect(
      applyCvePreset(documentOf(ASSERTION_SIGNED), "CVE-2025-23369"),
    ).toStrictEqual({
      kind: "NotApplicable",
      reason: "this preset needs a signature over the Response",
    });
  });

  it("nests the signed copy inside the signature and renames the outer Response", () => {
    const outcome = applyCvePreset(
      documentOf(RESPONSE_SIGNED),
      "CVE-2025-23369",
    );
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.xml).toContain('ID="_cve_2025_23369"');
    expect(outcome.xml).toContain('ID="_r1"');
  });
});

describe("the parser differential presets", () => {
  it.each(["CVE-2017-11428", "CVE-2025-25291"] as const)(
    "%s splits the NameID around an empty comment",
    (id: CveId) => {
      const outcome = applyCvePreset(documentOf(ASSERTION_SIGNED), id);
      if (outcome.kind !== "Ok") throw new Error(outcome.reason);

      expect(outcome.xml).toContain("alice<!---->@example.com");
    },
  );

  it("still reads as the whole address to a DOM parser, which is the point", () => {
    const outcome = applyCvePreset(
      documentOf(ASSERTION_SIGNED),
      "CVE-2025-25291",
    );
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    const nameId = documentOf(outcome.xml).getElementsByTagNameNS(
      "urn:oasis:names:tc:SAML:2.0:assertion",
      "NameID",
    )[0];

    expect(nameId?.textContent).toBe("alice@example.com");
  });

  it("targets a NameID outside the signed Assertion, unlike its companion", () => {
    const outcome = applyCvePreset(
      documentOf(ASSERTION_SIGNED),
      "CVE-2025-25292",
    );

    expect(outcome).toStrictEqual({
      kind: "NotApplicable",
      reason: "this Response carries no NameID outside the signed Assertion",
    });
  });

  it("splits a Response level NameID when one exists", () => {
    const withOuter = ASSERTION_SIGNED.replace(
      "</samlp:Response>",
      '<saml:NameID xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">carol@example.com</saml:NameID></samlp:Response>',
    );
    const outcome = applyCvePreset(documentOf(withOuter), "CVE-2025-25292");
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.xml).toContain("carol<!---->@example.com");
    expect(outcome.xml).toContain("alice@example.com");
  });

  it("refuses when there is no @ to split on", () => {
    const outcome = applyCvePreset(
      documentOf(ASSERTION_SIGNED.replace("alice@example.com", "alice")),
      "CVE-2025-25291",
    );

    expect(outcome).toStrictEqual({
      kind: "NotApplicable",
      reason:
        "the NameID has no @ to split on, so the differential cannot be built",
    });
  });
});

describe("the incomplete-fix preset", () => {
  it("uses more than one comment, which is what defeated the first fix", () => {
    const outcome = applyCvePreset(
      documentOf(ASSERTION_SIGNED),
      "CVE-2018-0489",
    );
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.xml).toContain("alice<!----><!---->@example.com");
  });
});

describe("the unsigned-response preset", () => {
  it("removes the Response signature and leaves the Assertion signature", () => {
    const both = documentOf(read("signed-both-by-us.xml"));
    expect(readSignatures(both)).toHaveLength(2);

    const outcome = applyCvePreset(both, "CVE-2024-45409");
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    const after = documentOf(outcome.xml);

    expect(readSignatures(after)).toHaveLength(1);
    expect(outcome.xml).not.toContain('URI="#_r1"');
    expect(outcome.xml).toContain('URI="#_a1"');
  });

  it("refuses when the Response is not signed to begin with", () => {
    expect(
      applyCvePreset(documentOf(ASSERTION_SIGNED), "CVE-2024-45409"),
    ).toStrictEqual({
      kind: "NotApplicable",
      reason: "this preset needs a signature over the Response to remove",
    });
  });
});
