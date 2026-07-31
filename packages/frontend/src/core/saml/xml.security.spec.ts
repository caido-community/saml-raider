// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { readMessageInfo } from "./messageInfo";
import { prettyPrintForDisplay } from "./pretty";
import { findElements, parseXml } from "./xml";

import { SAML_RESPONSE } from "@/tests/fixtures";

const parsed = (xml: string): Document => {
  const outcome = parseXml(xml);
  if (outcome.kind !== "Ok") {
    throw new Error(`expected Ok, received ${outcome.kind}`);
  }
  return outcome.document;
};

describe("CDATA cannot smuggle markup", () => {
  it("keeps CDATA content as text, not as elements", () => {
    const document = parsed("<r><a><![CDATA[<not>a tag</not>]]></a></r>");
    const wrapper = findElements(document, "a")[0];

    expect(wrapper?.textContent).toBe("<not>a tag</not>");
    expect(wrapper?.children).toHaveLength(0);
  });

  it("does not let CDATA introduce an Assertion the analyser would count", () => {
    const document = parsed(
      '<Response><![CDATA[<Assertion ID="_evil"/>]]></Response>',
    );

    expect(findElements(document, "Assertion")).toHaveLength(0);
    expect(readMessageInfo(document).assertionCount).toBe(0);
  });

  it("does not let CDATA forge a Signature element", () => {
    const document = parsed("<Response><![CDATA[<Signature/>]]></Response>");

    expect(readMessageInfo(document).signedElements).toHaveLength(0);
  });
});

describe("doctype rejection holds in a second DOM implementation", () => {
  it("never returns a usable document for an external entity", () => {
    const outcome = parseXml(
      `<!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><r>&xxe;</r>`,
    );

    expect(outcome.kind).not.toBe("Ok");
  });

  it("refuses a doctype whose entity is never dereferenced", () => {
    const outcome = parseXml(
      `<!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><r>safe</r>`,
    );

    expect(outcome).toStrictEqual({ kind: "DoctypeRejected", name: "r" });
  });

  it("refuses a doctype even when the document is otherwise valid SAML", () => {
    const outcome = parseXml(`<!DOCTYPE samlp:Response>${SAML_RESPONSE}`);

    expect(outcome.kind).toBe("DoctypeRejected");
  });

  it("accepts the same SAML message without a doctype", () => {
    expect(parseXml(SAML_RESPONSE).kind).toBe("Ok");
  });
});

describe("analysis agrees across DOM implementations", () => {
  it("reads the same message facts jsdom and happy-dom must both produce", () => {
    const info = readMessageInfo(parsed(SAML_RESPONSE));

    expect(info).toMatchObject({
      kind: "Response",
      id: "_r1",
      issuer: "https://idp.example.com",
      subject: "alice@example.com",
      assertionCount: 1,
      encryptedAssertionCount: 0,
      hasDuplicateIds: false,
    });
    expect(info.signedElements).toStrictEqual([
      { element: "Response", id: "_r1" },
    ]);
  });
});

describe("deeply nested XML cannot crash the decoding pipeline", () => {
  const nested = (depth: number): string =>
    `<r>${"<a>".repeat(depth)}x${"</a>".repeat(depth)}</r>`;

  it("traverses and prints 6000 levels without overflowing the stack", () => {
    const outcome = parseXml(nested(6000));
    if (outcome.kind !== "Ok") {
      throw new Error(`expected Ok, received ${outcome.kind}`);
    }

    expect(readMessageInfo(outcome.document).assertionCount).toBe(0);
    expect(prettyPrintForDisplay(outcome.document).length).toBeGreaterThan(0);
  }, 20000);
});
