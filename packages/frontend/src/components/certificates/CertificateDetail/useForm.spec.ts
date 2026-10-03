// @vitest-environment happy-dom
import { type Certificate } from "shared";
import { describe, expect, it } from "vitest";

import { useForm } from "./useForm";

import { buildCertificate } from "@/tests/certificateService";
import { mountComposable } from "@/tests/mountComposable";

const emit = () => undefined;

const build = (overrides: Partial<Certificate> = {}) =>
  mountComposable(() =>
    useForm({ certificate: () => buildCertificate("a", overrides), emit }),
  );

const withValidity = (notBefore: string, notAfter: string) =>
  build({
    details: { ...buildCertificate("a").details, notBefore, notAfter },
  });

const PAST = "2000-01-01T00:00:00.000Z";
const FUTURE = "2999-01-01T00:00:00.000Z";

describe("validity", () => {
  it("reports a certificate inside its window as valid", async () => {
    const form = await withValidity(PAST, FUTURE);

    expect(form.expiry.value.kind).toBe("Valid");
  });

  it("reports an expired certificate and says when it lapsed", async () => {
    const form = await withValidity(PAST, PAST);

    expect(form.expiry.value.kind).toBe("Expired");
    expect(
      form.expiry.value.kind === "Expired" && form.expiry.value.message,
    ).toContain("2000");
  });

  it("distinguishes not-yet-valid from expired", async () => {
    const form = await withValidity(FUTURE, FUTURE);

    expect(form.expiry.value.kind).toBe("NotYetValid");
  });
});

describe("badges", () => {
  it("shows the source, the key state and the validity", async () => {
    const form = await build({ source: "Generated", hasPrivateKey: true });

    expect(form.badges.value.map((badge) => badge.label)).toEqual([
      "Generated",
      "Private key available",
      "Valid",
    ]);
  });

  it("says so when there is no private key", async () => {
    const form = await build({ hasPrivateKey: false });

    expect(form.badges.value[1]?.label).toBe("No private key");
    expect(form.hasPrivateKey.value).toBe(false);
  });
});

describe("field groups", () => {
  it("formats fingerprints as colon-separated pairs", async () => {
    const form = await build({
      details: {
        ...buildCertificate("a").details,
        fingerprintSha256: "aabbcc",
      },
    });

    const fingerprints = form.groups.value.find(
      (group) => group.title === "Fingerprints",
    );

    expect(fingerprints?.fields[0]?.value).toBe("aa:bb:cc");
  });

  it("marks only the certificate's own fields as covered by the signature", async () => {
    const form = await build();
    const byTitle = new Map(
      form.groups.value.map((group) => [group.title, group.isSigned]),
    );

    expect(byTitle.get("Storage")).toBe(false);
    expect(byTitle.get("Identity and validity")).toBe(true);
    expect(byTitle.get("Public key")).toBe(true);
  });

  it("shows a placeholder rather than a blank for absent values", async () => {
    const form = await build({
      details: {
        ...buildCertificate("a").details,
        subjectAlternativeNames: [],
      },
    });

    const names = form.groups.value.find(
      (group) => group.title === "Names and identifiers",
    );

    expect(names?.fields[0]?.value).toBe("Not available");
  });
});
