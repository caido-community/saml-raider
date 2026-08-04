import { err } from "shared";
import { describe, expect, it } from "vitest";

import { useForm } from "./useForm";

import {
  buildCertificate,
  buildServiceDouble,
} from "@/tests/certificateService";
import {
  LEAF_CERTIFICATE_DER_BASE64,
  LEAF_FINGERPRINT_SHA256,
} from "@/tests/fixtures";

const LEAF_BASE64 = btoa("a certificate");

describe("reviewing before sending", () => {
  it("refuses rather than treating an unreadable store as empty", async () => {
    const { service } = buildServiceDouble([], "the store is unreadable");
    const form = useForm(() => [LEAF_BASE64], service);

    await form.review();

    expect(form.state.value.kind).toBe("Failed");
    expect(form.message.value).toContain("the store is unreadable");
  });

  it("fingerprints a real certificate exactly as openssl does", async () => {
    const { service } = buildServiceDouble([]);
    const form = useForm(() => [LEAF_CERTIFICATE_DER_BASE64], service);

    await form.review();

    expect(form.rows.value[0]?.fingerprintSha256).toBe(LEAF_FINGERPRINT_SHA256);
  });

  it("fingerprints each certificate the same way the backend derives an id", async () => {
    const { service } = buildServiceDouble([]);
    const form = useForm(() => [LEAF_BASE64], service);

    await form.review();

    expect(form.rows.value).toHaveLength(1);
    expect(form.rows.value[0]?.fingerprintSha256).toHaveLength(64);
    expect(form.rows.value[0]?.fingerprintSha256).toMatch(/^[0-9a-f]+$/);
  });

  it("marks a certificate already in the store as a duplicate", async () => {
    const form = useForm(() => [LEAF_BASE64], buildServiceDouble([]).service);
    await form.review();
    const fingerprint = form.rows.value[0]?.fingerprintSha256 ?? "";

    const { service } = buildServiceDouble([buildCertificate(fingerprint)]);
    const second = useForm(() => [LEAF_BASE64], service);
    await second.review();

    expect(second.rows.value[0]?.isAlreadyStored).toBe(true);
    expect(second.newCount.value).toBe(0);
  });

  it("counts only the certificates that would actually be added", async () => {
    const form = useForm(
      () => [LEAF_BASE64, btoa("another")],
      buildServiceDouble([]).service,
    );

    await form.review();

    expect(form.newCount.value).toBe(2);
  });

  it("opens without writing anything", async () => {
    const { service, calls } = buildServiceDouble([]);
    const form = useForm(() => [LEAF_BASE64], service);

    await form.review();

    expect(form.isOpen.value).toBe(true);
    expect(calls.importExtracted).toEqual([]);
  });
});

describe("sending", () => {
  it("stores only the certificates that are not already present", async () => {
    const form = useForm(() => [LEAF_BASE64], buildServiceDouble([]).service);
    await form.review();
    const fingerprint = form.rows.value[0]?.fingerprintSha256 ?? "";

    const { service, calls } = buildServiceDouble([
      buildCertificate(fingerprint),
    ]);
    const second = useForm(() => [LEAF_BASE64], service);
    await second.review();
    await second.send();

    expect(calls.importExtracted).toEqual([]);
    expect(second.message.value).toContain("already stored");
  });

  it("sends the new ones and reports how many", async () => {
    const { service, calls } = buildServiceDouble([]);
    const form = useForm(() => [LEAF_BASE64], service);
    await form.review();

    await form.send();

    expect(calls.importExtracted).toEqual([LEAF_BASE64]);
    expect(form.message.value).toContain("Sent 1 certificate");
  });

  it("reports a failure instead of claiming success", async () => {
    const { service } = buildServiceDouble([]);
    const form = useForm(() => [LEAF_BASE64], {
      ...service,
      importExtractedCertificate: () => Promise.resolve(err("storage is full")),
    });
    await form.review();

    await form.send();

    expect(form.message.value).toContain("storage is full");
    expect(form.state.value.kind).toBe("Failed");
  });

  it("keeps the ones that were stored before the failure marked as stored", async () => {
    const { service } = buildServiceDouble([]);
    let attempts = 0;
    const form = useForm(() => [LEAF_BASE64, LEAF_CERTIFICATE_DER_BASE64], {
      ...service,
      importExtractedCertificate: (encoded: string) => {
        attempts += 1;
        return attempts === 1
          ? service.importExtractedCertificate(encoded)
          : Promise.resolve(err("storage is full"));
      },
    });
    await form.review();

    await form.send();

    expect(form.state.value.kind).toBe("Failed");
    expect(form.newCount.value).toBe(1);
  });

  it("does not offer to send the same certificate twice", async () => {
    const { service, calls } = buildServiceDouble([]);
    const form = useForm(() => [LEAF_BASE64], service);
    await form.review();

    await form.send();
    await form.send();

    expect(calls.importExtracted).toHaveLength(1);
    expect(form.newCount.value).toBe(0);
  });
});

describe("nothing to send", () => {
  it("produces no rows when the message carries no certificate", async () => {
    const { service } = buildServiceDouble([]);
    const form = useForm(() => [], service);

    await form.review();

    expect(form.rows.value).toEqual([]);
    expect(form.newCount.value).toBe(0);
  });
});
