// @vitest-environment jsdom
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { ok, type Result } from "shared";
import { describe, expect, it } from "vitest";

import { useForm } from "./useForm";

import { type CertificateService } from "@/services/certificates";
import { buildServiceDouble } from "@/tests/certificateService";
import {
  DUPLICATE_ID,
  EVIL_SIBLING_FIRST,
  REFERENCE_TO_NOTHING,
  UNWRAPPED,
} from "@/tests/wrapping";
import { decodeBase64 } from "@/utils";

const NO_SIGNATURE =
  '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_r1"/>';

const buildService = (): CertificateService => buildServiceDouble([]).service;

const SIGNING = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../tests/signing",
);

const read = (name: string) => readFileSync(join(SIGNING, name), "utf8");

const SIGNED = read("signed-by-us.xml");

const ALGORITHM = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

const verifyWithWebCrypto = async (input: {
  signatureBase64: string;
  signedInfoBase64: string;
}) => {
  const decode = (base64: string) => {
    const bytes = decodeBase64(base64.replace(/\s+/g, ""));
    if (bytes === undefined || bytes === null) throw new Error("bad base64");
    return bytes;
  };

  const key = await crypto.subtle.importKey(
    "spki",
    decode(read("leaf-pubkey.spki.b64")),
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

describe("checking a message", () => {
  it("starts idle rather than pretending it has already checked", () => {
    const form = useForm(() => UNWRAPPED, buildService());

    expect(form.state.value.kind).toBe("Idle");
    expect(form.rows.value).toEqual([]);
  });

  it("says so when the message is not well-formed XML", async () => {
    const form = useForm(() => "<samlp:Response", buildService());

    await form.check();

    expect(form.state.value.kind).toBe("Unparseable");
  });

  it("reports no signature rather than failing", async () => {
    const form = useForm(() => NO_SIGNATURE, buildService());

    await form.check();

    expect(form.state.value.kind).toBe("Ready");
    expect(form.rows.value).toEqual([]);
    expect(form.warning.value).toBe("");
  });

  it("lists a row per signature with where it sits and what it covers", async () => {
    const form = useForm(() => UNWRAPPED, buildService());

    await form.check();

    expect(form.rows.value).toHaveLength(1);
    expect(form.rows.value[0]?.coveredId).toBe("_a1");
    expect(form.rows.value[0]?.parentPath).toBe("Response");
  });

  it("re-reads the message on every check so an edited draft is not stale", async () => {
    let current = NO_SIGNATURE;
    const form = useForm(() => current, buildService());

    await form.check();
    expect(form.rows.value).toHaveLength(0);

    current = UNWRAPPED;
    await form.check();

    expect(form.rows.value).toHaveLength(1);
  });
});

describe("reporting wrapping", () => {
  it("warns when the signed assertion is not the one a consumer reads", async () => {
    const form = useForm(() => EVIL_SIBLING_FIRST, buildService());

    await form.check();

    expect(form.warning.value).toContain("signature wrapping");
    expect(form.warning.value).toContain("_a1");
  });

  it("warns when more than one element carries the signed id", async () => {
    const form = useForm(() => DUPLICATE_ID, buildService());

    await form.check();

    expect(form.warning.value).toContain("share the signed ID _a1");
  });

  it("warns when the signature covers an id no element carries", async () => {
    const form = useForm(() => REFERENCE_TO_NOTHING, buildService());

    await form.check();

    expect(form.warning.value).toContain("no element carries it");
  });

  it("stays quiet on a message whose signature covers what it should", async () => {
    const form = useForm(() => UNWRAPPED, buildService());

    await form.check();

    expect(form.warning.value).toBe("");
  });
});

describe("outcomes", () => {
  it("calls a signature invalid when the digest does not match the element", async () => {
    const form = useForm(() => UNWRAPPED, buildService());

    await form.check();

    expect(form.rows.value[0]?.label).toBe("Invalid");
    expect(form.rows.value[0]?.tone).toBe("Bad");
    expect(form.rows.value[0]?.detail).toContain("has changed since it was");
  });

  it("calls a genuinely intact signature intact", async () => {
    const form = useForm(() => SIGNED, {
      ...buildService(),
      verifySignature: verifyWithWebCrypto,
    });

    await form.check();

    expect(form.rows.value[0]?.label).toBe("Intact");
    expect(form.rows.value[0]?.tone).toBe("Good");
    expect(form.warning.value).toBe("");
  });

  it("does not claim a verdict when the backend refuses to verify", async () => {
    const { service } = buildServiceDouble([], "the key store is unreadable");
    const form = useForm(() => SIGNED, service);

    await form.check();

    expect(form.rows.value[0]?.label).toBe("Not checked");
    expect(form.rows.value[0]?.tone).toBe("Unknown");
    expect(form.rows.value[0]?.detail).toContain("the key store is unreadable");
  });
});

describe("stale results", () => {
  it("drops a slow check whose result arrived after a newer one", async () => {
    const parked: Array<() => void> = [];
    let current = UNWRAPPED;

    const form = useForm(() => current, {
      ...buildService(),
      verifySignature: () =>
        new Promise<Result<boolean>>((resolve) => {
          parked.push(() => resolve(ok(true)));
        }),
    });

    const slow = form.check();

    current = NO_SIGNATURE;
    await form.check();
    expect(form.rows.value).toHaveLength(0);

    parked.forEach((release) => release());
    await slow;

    expect(form.rows.value).toHaveLength(0);
    expect(form.state.value.kind).toBe("Ready");
  });
});
