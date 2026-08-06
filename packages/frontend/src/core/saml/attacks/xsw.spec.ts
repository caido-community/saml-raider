// @vitest-environment jsdom
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { ok } from "shared";
import { describe, expect, it } from "vitest";

import {
  applyXsw,
  EVIL_ASSERTION_ID,
  EVIL_RESPONSE_ID,
  isXswApplicable,
  readXswTarget,
  XSW_VARIANTS,
  type XswVariant,
} from "./xsw";

import { readSignatures, verifySignature } from "@/core/saml/verify";
import { readWrappingRisk } from "@/core/saml/wrapping";
import { parseXml, serializeXml } from "@/core/saml/xml";
import { decodeBase64, isAbsent } from "@/utils";

const HERE = dirname(fileURLToPath(import.meta.url));

const read = (folder: string, name: string) =>
  readFileSync(join(HERE, "../../../tests", folder, name), "utf8");

const ASSERTION_SIGNED = read("signing", "signed-by-us.xml");

const RESPONSE_SIGNED = read("signing", "signed-response-by-us.xml");

const ALGORITHM = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

const decode = (base64: string): Uint8Array => {
  const bytes = decodeBase64(base64.replace(/\s+/g, ""));
  if (isAbsent(bytes)) throw new Error("the fixture is not valid base64");
  return bytes;
};

const verifyWithWebCrypto = async (input: {
  signatureBase64: string;
  signedInfoBase64: string;
}) => {
  const key = await crypto.subtle.importKey(
    "spki",
    decode(read("signing", "leaf-pubkey.spki.b64")),
    ALGORITHM,
    false,
    ["verify"],
  );

  return ok(
    await crypto.subtle.verify(
      ALGORITHM.name,
      key,
      decode(input.signatureBase64),
      decode(input.signedInfoBase64),
    ),
  );
};

const documentOf = (xml: string): Document => {
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") throw new Error("fixture did not parse");
  return parsed.document;
};

const sourceFor = (variant: XswVariant): string =>
  readXswTarget(variant) === "Response" ? RESPONSE_SIGNED : ASSERTION_SIGNED;

const wrap = (variant: XswVariant): string => {
  const outcome = applyXsw(documentOf(sourceFor(variant)), variant);
  if (outcome.kind !== "Ok") throw new Error(`${variant}: ${outcome.reason}`);
  return outcome.xml;
};

describe("every variant against its committed golden", () => {
  it.each(XSW_VARIANTS)(
    "%s produces exactly the tree an independent verifier was run against",
    (variant) => {
      expect(wrap(variant)).toBe(read("xsw", `${variant}.xml`));
    },
  );
});

describe("purity", () => {
  it.each(XSW_VARIANTS)(
    "%s does not mutate the document it was given",
    (variant) => {
      const source = sourceFor(variant);
      const document = documentOf(source);

      applyXsw(document, variant);

      expect(serializeXml(document)).toBe(source);
    },
  );
});

describe("applicability", () => {
  it("refuses the Response variants when only the Assertion is signed", () => {
    const document = documentOf(ASSERTION_SIGNED);

    expect(isXswApplicable(document, "XSW1")).toBe(false);
    expect(applyXsw(document, "XSW1")).toStrictEqual({
      kind: "NotApplicable",
      reason: "the Response carries no signature",
    });
  });

  it("refuses the Assertion variants when only the Response is signed", () => {
    expect(isXswApplicable(documentOf(RESPONSE_SIGNED), "XSW3")).toBe(false);
  });

  it("refuses a message that is not a SAML Response", () => {
    expect(applyXsw(documentOf("<a/>"), "XSW3")).toStrictEqual({
      kind: "NotApplicable",
      reason: "this message is not a SAML Response",
    });
  });

  it("refuses a signed element with no ID to reference", () => {
    const document = documentOf(ASSERTION_SIGNED.replace(' ID="_a1"', ""));

    expect(applyXsw(document, "XSW3")).toStrictEqual({
      kind: "NotApplicable",
      reason: "the Assertion has no ID attribute to reference",
    });
  });
});

describe("the parity identifiers", () => {
  it("renames the in-place Response for the Response variants", () => {
    expect(wrap("XSW1")).toContain(`ID="${EVIL_RESPONSE_ID}"`);
    expect(wrap("XSW2")).toContain(`ID="${EVIL_RESPONSE_ID}"`);
  });

  it("uses the evil Assertion id only where upstream does", () => {
    for (const variant of ["XSW3", "XSW4", "XSW5", "XSW6"] as const) {
      expect(wrap(variant)).toContain(`ID="${EVIL_ASSERTION_ID}"`);
    }
  });

  it("invents no identifier for the duplicate-id variants", () => {
    expect(wrap("XSW7")).not.toContain(EVIL_ASSERTION_ID);
    expect(wrap("XSW8")).not.toContain(EVIL_ASSERTION_ID);
  });
});

describe("what each variant does to a real signature", () => {
  it.each(["XSW3", "XSW4", "XSW5", "XSW6"] as const)(
    "%s keeps the signature verifiable while the signed element is no longer the consumed one",
    async (variant) => {
      const document = documentOf(wrap(variant));
      const signature = readSignatures(document)[0];
      if (isAbsent(signature)) throw new Error("the wrap lost the signature");

      expect(
        await verifySignature(signature, verifyWithWebCrypto),
      ).toStrictEqual({ kind: "Valid", referenceIds: ["_a1"] });
      expect(readWrappingRisk(document).kind).not.toBe("None");
    },
  );

  it.each(["XSW7", "XSW8"] as const)(
    "%s creates a duplicate id, which this plugin refuses to resolve rather than guess",
    async (variant) => {
      const document = documentOf(wrap(variant));
      const signature = readSignatures(document)[0];
      if (isAbsent(signature)) throw new Error("the wrap lost the signature");

      expect(
        await verifySignature(signature, verifyWithWebCrypto),
      ).toStrictEqual({ kind: "Unverifiable", reason: "ReferenceAmbiguous" });
      expect(readWrappingRisk(document).kind).toBe("DuplicateId");
    },
  );

  it("leaves exactly one signature in every variant", () => {
    for (const variant of XSW_VARIANTS) {
      expect(readSignatures(documentOf(wrap(variant)))).toHaveLength(1);
    }
  });
});

describe("the audit trail", () => {
  it("describes what changed, naming the id it moved", () => {
    const outcome = applyXsw(documentOf(ASSERTION_SIGNED), "XSW3");
    if (outcome.kind !== "Ok") throw new Error("expected a transformation");

    expect(outcome.description).toContain("_a1");
    expect(outcome.description).toContain(EVIL_ASSERTION_ID);
  });
});

describe("a message signed at both levels, as real identity providers emit", () => {
  const BOTH_SIGNED = read("signing", "signed-both-by-us.xml");

  const wrapBoth = (variant: XswVariant): string => {
    const outcome = applyXsw(documentOf(BOTH_SIGNED), variant);
    if (outcome.kind !== "Ok") throw new Error(`${variant}: ${outcome.reason}`);
    return outcome.xml;
  };

  it("carries two signatures to begin with", () => {
    expect(readSignatures(documentOf(BOTH_SIGNED))).toHaveLength(2);
  });

  const signatureCovering = (document: Document, id: string): Element => {
    const found = readSignatures(document).find((signature) =>
      Array.from(signature.getElementsByTagName("*")).some(
        (element) =>
          element.localName === "Reference" &&
          element.getAttribute("URI") === `#${id}`,
      ),
    );
    if (isAbsent(found)) throw new Error(`no signature covers ${id}`);
    return found;
  };

  it.each(["XSW1", "XSW2"] as const)(
    "%s keeps the Response signature verifiable, so the nested Assertion signature must survive the clone",
    async (variant) => {
      const document = documentOf(wrapBoth(variant));

      expect(
        await verifySignature(
          signatureCovering(document, "_r1"),
          verifyWithWebCrypto,
        ),
      ).toStrictEqual({ kind: "Valid", referenceIds: ["_r1"] });
    },
  );

  it.each(["XSW1", "XSW2"] as const)(
    "%s flags the wrapping it just created",
    (variant) => {
      expect(readWrappingRisk(documentOf(wrapBoth(variant))).kind).not.toBe(
        "None",
      );
    },
  );

  it("reports no wrapping on the untouched control", () => {
    expect(readWrappingRisk(documentOf(BOTH_SIGNED)).kind).toBe("None");
  });
});
