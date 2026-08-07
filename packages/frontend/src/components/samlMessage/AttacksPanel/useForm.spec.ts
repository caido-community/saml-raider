// @vitest-environment jsdom
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { describe, expect, it } from "vitest";

import { useForm } from "./useForm";

import {
  buildCertificate,
  buildServiceDouble,
} from "@/tests/certificateService";

const SIGNED = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../tests/signing/signed-by-us.xml",
  ),
  "utf8",
);

const build = (
  xml = SIGNED,
  certificates = [buildCertificate("k", { hasPrivateKey: true })],
) => {
  const applied: string[] = [];
  let current = xml;
  const form = useForm(
    () => current,
    buildServiceDouble(certificates).service,
    (next: string) => {
      applied.push(next);
      current = next;
    },
  );
  return { ...form, applied, read: () => current };
};

describe("the working message", () => {
  it("starts unchanged and writes nothing on its own", () => {
    const form = build();

    expect(form.applied).toStrictEqual([]);
    expect(form.stage.value.kind).toBe("Idle");
  });

  it("writes nothing while a preview is only being shown", () => {
    const form = build();

    form.previewXsw("XSW3");

    expect(form.stage.value.kind).toBe("Preview");
    expect(form.applied).toStrictEqual([]);
  });

  it("writes to the request on confirm, with no second step", () => {
    const form = build();
    form.previewXsw("XSW3");

    form.confirm();

    expect(form.applied).toHaveLength(1);
    expect(form.applied[0]).toContain("_evil_assertion_ID");
    expect(form.stage.value.kind).toBe("Idle");
  });

  it("writes nothing on discard", () => {
    const form = build();
    form.previewXsw("XSW3");

    form.discard();

    expect(form.applied).toStrictEqual([]);
    expect(form.stage.value.kind).toBe("Idle");
  });

  it("chains one attack onto the result of the last", () => {
    const form = build();
    form.previewXsw("XSW3");
    form.confirm();
    const afterFirst = form.read();

    form.search.value = "alice@example.com";
    form.replacement.value = "admin@example.com";
    form.previewReplace();
    form.confirm();

    expect(form.read()).not.toBe(afterFirst);
    expect(form.read()).toContain("admin@example.com");
  });
});

describe("what the preview tells the user", () => {
  it("shows a diff and says what the change means", () => {
    const form = build();

    form.previewXsw("XSW3");

    const stage = form.stage.value;
    if (stage.kind !== "Preview") throw new Error("expected a preview");
    expect(stage.diff.added).toBeGreaterThan(0);
    expect(stage.description).toContain("_a1");
    expect(stage.effect).not.toBe("");
  });
});

describe("refusing rather than guessing", () => {
  it("refuses a variant that does not apply to this message", () => {
    const form = build();

    form.previewXsw("XSW1");

    expect(form.stage.value).toStrictEqual({
      kind: "Refused",
      reason: "XSW1 does not apply to this message",
    });
  });

  it("marks inapplicable variants so the button can be disabled", () => {
    const byName = new Map(
      build()
        .groups.value.flatMap((group) => group.items)
        .map((item) => [item.value, item.reason === ""]),
    );

    expect(byName.get("XSW1")).toBe(false);
    expect(byName.get("XSW3")).toBe(true);
  });

  it("refuses a replacement that matches nothing", () => {
    const form = build();
    form.search.value = "nobody@example.com";
    form.replacement.value = "x";

    form.previewReplace();

    expect(form.stage.value).toStrictEqual({
      kind: "Refused",
      reason: "nothing matched that search",
    });
  });

  it("refuses a payload with no callback URL", () => {
    const form = build();

    form.previewXxe();

    expect(form.stage.value.kind).toBe("Refused");
  });

  it("refuses to re-sign without a certificate that has a private key", async () => {
    const form = build(SIGNED, []);
    await form.loadCertificates();

    await form.previewResign("Assertion");

    expect(form.stage.value).toStrictEqual({
      kind: "Refused",
      reason: "choose a certificate that has a private key",
    });
  });
});

describe("choosing a signing certificate", () => {
  it("offers only certificates that can actually sign", async () => {
    const form = build(SIGNED, [
      buildCertificate("no-key", { hasPrivateKey: false }),
      buildCertificate("with-key", { hasPrivateKey: true }),
    ]);

    await form.loadCertificates();

    expect(
      form.signingCertificates.value.map((entry) => entry.id),
    ).toStrictEqual(["with-key"]);
    expect(form.certificateId.value).toBe("with-key");
  });

  it("reports a store it could not read rather than showing an empty list", async () => {
    const { service } = buildServiceDouble([], "the store is unreadable");
    const form = useForm(
      () => SIGNED,
      service,
      () => undefined,
    );

    await form.loadCertificates();

    expect(form.stage.value).toStrictEqual({
      kind: "Refused",
      reason: "the store is unreadable",
    });
  });
});

describe("payloads", () => {
  it("builds an XXE payload once a callback is given", () => {
    const form = build();
    form.callbackUrl.value = "http://attacker.example";

    form.previewXxe();

    const stage = form.stage.value;
    if (stage.kind !== "Preview") throw new Error("expected a preview");
    expect(stage.xml).toContain("<!DOCTYPE");
    expect(stage.effect).toContain("never resolves it");
  });

  it("removes every signature when asked", () => {
    const form = build();

    form.previewRemoveSignatures();

    const stage = form.stage.value;
    if (stage.kind !== "Preview") throw new Error("expected a preview");
    expect(stage.xml).not.toContain("ds:Signature");
  });
});

describe("SOAP envelopes", () => {
  const envelope = (saml: string) =>
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body>${saml}</soap:Body></soap:Envelope>`;

  it("attacks the SAML inside the envelope and gives the envelope back", () => {
    const form = build(envelope(SIGNED));

    form.previewXsw("XSW3");

    const stage = form.stage.value;
    if (stage.kind !== "Preview") throw new Error("expected a preview");
    expect(stage.xml.startsWith("<soap:Envelope")).toBe(true);
    expect(stage.xml).toContain("_evil_assertion_ID");
    expect(stage.xml).toContain("soap:Body");
  });

  it("keeps the envelope when a change is kept", () => {
    const form = build(envelope(SIGNED));
    form.previewXsw("XSW3");

    form.confirm();

    expect(form.read().startsWith("<soap:Envelope")).toBe(true);
  });

  it("offers the same variants as the bare message", () => {
    const reasons = (xml: string) =>
      build(xml)
        .groups.value.flatMap((group) => group.items)
        .map((item) => [item.value, item.reason] as const);

    expect(reasons(envelope(SIGNED))).toStrictEqual(reasons(SIGNED));
  });
});

describe("CVE presets", () => {
  it("previews a preset and explains what acceptance would mean", () => {
    const form = build();

    form.previewCve("CVE-2022-41912");

    const stage = form.stage.value;
    if (stage.kind !== "Preview") throw new Error("expected a preview");
    expect(stage.label).toBe("CVE-2022-41912");
    expect(stage.effect).toContain("proves nothing");
  });

  it("refuses a preset that does not fit this message", () => {
    const form = build();

    form.previewCve("CVE-2025-23369");

    expect(form.stage.value).toStrictEqual({
      kind: "Refused",
      reason: "this preset needs a signature over the Response",
    });
  });
});

describe("what the cards can offer on this message", () => {
  it("groups every attack under a heading", () => {
    const labels = build().groups.value.map((group) => group.label);

    expect(labels).toStrictEqual([
      "Signature wrapping",
      "Signatures",
      "Known CVEs",
    ]);
  });

  it("keeps the full identifier so the label can drop the CVE prefix", () => {
    const cves = build().groups.value.find(
      (group) => group.label === "Known CVEs",
    );

    expect(cves?.items.length).toBeGreaterThanOrEqual(7);
    for (const item of cves?.items ?? []) {
      expect(item.value.startsWith("CVE-")).toBe(true);
    }
  });

  it("gives a reason for every action it cannot offer", () => {
    const blocked = build()
      .groups.value.flatMap((group) => group.items)
      .filter((item) => item.reason !== "");

    expect(blocked.length).toBeGreaterThan(0);
    for (const item of blocked) expect(item.reason).not.toBe("");
  });

  it("blocks a wrapping variant this message cannot carry, naming why", () => {
    const reason = build()
      .groups.value.flatMap((group) => group.items)
      .find((item) => item.value === "XSW1")?.reason;

    expect(reason).toBe(
      "this message has no signature at the level this variant rewrites",
    );
  });

  it("leaves an applicable variant unblocked", () => {
    const reason = build()
      .groups.value.flatMap((group) => group.items)
      .find((item) => item.value === "XSW3")?.reason;

    expect(reason).toBe("");
  });
});

describe("running the attack each card has selected", () => {
  it("runs the chosen wrapping variant", () => {
    const form = build();
    form.wrapping.value = "XSW4";

    form.runWrapping();

    const stage = form.stage.value;
    if (stage.kind !== "Preview") throw new Error("expected a preview");
    expect(stage.label).toBe("XSW4");
  });

  it("runs the chosen CVE preset", () => {
    const form = build();
    form.cve.value = "CVE-2022-41912";

    form.runCve();

    const stage = form.stage.value;
    if (stage.kind !== "Preview") throw new Error("expected a preview");
    expect(stage.label).toBe("CVE-2022-41912");
  });

  it("runs whichever payload the card is set to", () => {
    const form = build();
    form.callbackUrl.value = "http://attacker.example";

    form.runPayload();
    expect(form.stage.value.kind).toBe("Preview");

    form.payload.value = "Xslt";
    form.runPayload();

    const stage = form.stage.value;
    if (stage.kind !== "Preview") throw new Error("expected a preview");
    expect(stage.label).toBe("XSLT");
  });
});

describe("nothing chosen yet", () => {
  it("starts each list empty so the placeholder shows", () => {
    const form = build();

    expect(form.wrapping.value).toBeUndefined();
    expect(form.cve.value).toBeUndefined();
  });

  it("asks for a choice rather than running something arbitrary", () => {
    const form = build();

    form.runWrapping();
    expect(form.stage.value).toStrictEqual({
      kind: "Refused",
      reason: "choose a wrapping variant",
    });

    form.runCve();
    expect(form.stage.value).toStrictEqual({
      kind: "Refused",
      reason: "choose a published issue",
    });
  });

  it("titles a CVE by its identifier alone, with the name on its own line", () => {
    const items =
      build().groups.value.find((group) => group.label === "Known CVEs")
        ?.items ?? [];

    for (const item of items) {
      expect(item.label).toMatch(/^CVE-\d{4}-\d+$/);
      expect(item.label).not.toContain("—");
      expect(item.note).not.toBe("");
    }
  });
});
