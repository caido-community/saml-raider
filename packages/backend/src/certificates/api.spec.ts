import { type Result } from "shared";
import { describe, expect, it } from "vitest";

import {
  CHAIN_PEM,
  EC_CERTIFICATE_PEM,
  FINGERPRINTS_SHA256,
  INTERMEDIATE_CERTIFICATE_PEM,
  LEAF_CERTIFICATE_DER_BASE64,
  LEAF_CERTIFICATE_PEM,
  LEAF_KEY_PEM,
  LEAF_KEY_PKCS1_PEM,
  LEAF_KEY_PKCS8_DER_BASE64,
  MALFORMED_CERTIFICATE_PEM,
  ROOT_KEY_PEM,
} from "../tests/fixtures";
import { buildMemoryFileSystem } from "../tests/memoryFileSystem";

import { buildCertificateApi } from "./api";
import { buildCertificateStore } from "./store";

const ROOT = "/plugin";

const buildApi = () => {
  const fileSystem = buildMemoryFileSystem();
  const store = buildCertificateStore(fileSystem, ROOT);
  const api = buildCertificateApi(store, () => "2026-08-04T00:00:00.000Z");
  return { api, fileSystem, store };
};

const expectOk = <T>(result: Result<T>): T => {
  if (result.kind !== "Ok") {
    throw new Error(`expected Ok, got ${JSON.stringify(result)}`);
  }
  return result.value;
};

describe("importing certificates", () => {
  it("stores a certificate under its openssl fingerprint", async () => {
    const { api } = buildApi();

    const imported = expectOk(
      await api.importCertificates({
        encoded: LEAF_CERTIFICATE_PEM,
        source: "Imported",
      }),
    );

    expect(imported).toHaveLength(1);
    expect(imported[0]?.certificate.id).toBe(FINGERPRINTS_SHA256.leaf);
    expect(imported[0]?.wasAlreadyStored).toBe(false);
  });

  it("reports a re-import as a duplicate instead of storing it twice", async () => {
    const { api } = buildApi();
    const input = {
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported" as const,
    };

    await api.importCertificates(input);
    const second = expectOk(await api.importCertificates(input));
    const all = expectOk(await api.listCertificates());

    expect(second[0]?.wasAlreadyStored).toBe(true);
    expect(all).toHaveLength(1);
  });

  it("imports a chain and links each certificate to its issuer", async () => {
    const { api } = buildApi();

    await api.importCertificates({ encoded: CHAIN_PEM, source: "Imported" });
    const all = expectOk(await api.listCertificates());

    const leaf = all.find((entry) => entry.id === FINGERPRINTS_SHA256.leaf);
    const intermediate = all.find(
      (entry) => entry.id === FINGERPRINTS_SHA256.intermediate,
    );
    const root = all.find((entry) => entry.id === FINGERPRINTS_SHA256.root);

    expect(all).toHaveLength(3);
    expect(leaf?.parentId).toBe(FINGERPRINTS_SHA256.intermediate);
    expect(intermediate?.parentId).toBe(FINGERPRINTS_SHA256.root);
    expect(root?.parentId).toBeUndefined();
  });

  it("refuses a key type it cannot represent", async () => {
    const { api } = buildApi();

    const result = await api.importCertificates({
      encoded: EC_CERTIFICATE_PEM,
      source: "Imported",
    });

    expect(result.kind).toBe("Error");
  });

  it("refuses a malformed certificate", async () => {
    const { api } = buildApi();

    const result = await api.importCertificates({
      encoded: MALFORMED_CERTIFICATE_PEM,
      source: "Imported",
    });

    expect(result.kind).toBe("Error");
  });

  it("refuses input with no certificate at all", async () => {
    const { api } = buildApi();

    const result = await api.importCertificates({
      encoded: "nothing here",
      source: "Imported",
    });

    expect(result.kind).toBe("Error");
  });
});

describe("formats other than PEM", () => {
  it("imports a certificate supplied as base64 DER", async () => {
    const { api } = buildApi();

    const imported = expectOk(
      await api.importCertificates({
        encoded: LEAF_CERTIFICATE_DER_BASE64,
        source: "Imported",
      }),
    );

    expect(imported[0]?.certificate.id).toBe(FINGERPRINTS_SHA256.leaf);
  });

  it("imports a PKCS#1 private key", async () => {
    const { api } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });

    const result = await api.importPrivateKey({
      certificateId: FINGERPRINTS_SHA256.leaf,
      privateKeyPem: LEAF_KEY_PKCS1_PEM,
    });

    expect(result.kind === "Ok" && result.value.hasPrivateKey).toBe(true);
  });

  it("imports a PKCS#8 private key supplied as base64 DER", async () => {
    const { api } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });

    const result = await api.importPrivateKey({
      certificateId: FINGERPRINTS_SHA256.leaf,
      privateKeyPem: LEAF_KEY_PKCS8_DER_BASE64,
    });

    expect(result.kind === "Ok" && result.value.hasPrivateKey).toBe(true);
  });

  it("refuses a key file that is neither PEM nor DER", async () => {
    const { api } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });

    const result = await api.importPrivateKey({
      certificateId: FINGERPRINTS_SHA256.leaf,
      privateKeyPem: "%%% not a key %%%",
    });

    expect(result.kind).toBe("Error");
  });
});

describe("private keys", () => {
  it("writes the key to its own file with mode 0600", async () => {
    const { api, fileSystem } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });

    await api.importPrivateKey({
      certificateId: FINGERPRINTS_SHA256.leaf,
      privateKeyPem: LEAF_KEY_PEM,
    });

    const entry = fileSystem.files.get(
      `${ROOT}/keys/${FINGERPRINTS_SHA256.leaf}.pem`,
    );
    expect(entry?.mode).toBe(0o600);
    expect(entry?.content).toContain("PRIVATE KEY");
  });

  it("refuses a key that belongs to a different certificate", async () => {
    const { api } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });

    const result = await api.importPrivateKey({
      certificateId: FINGERPRINTS_SHA256.leaf,
      privateKeyPem: ROOT_KEY_PEM,
    });

    expect(result.kind).toBe("Error");
  });

  it("reports availability without exposing the key", async () => {
    const { api } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });
    await api.importPrivateKey({
      certificateId: FINGERPRINTS_SHA256.leaf,
      privateKeyPem: LEAF_KEY_PEM,
    });

    const all = expectOk(await api.listCertificates());

    expect(JSON.stringify(all)).not.toContain("PRIVATE KEY");
    expect(JSON.stringify(all)).toContain('"hasPrivateKey":true');
  });

  it("returns the key only through the endpoint named for it", async () => {
    const { api } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });
    await api.importPrivateKey({
      certificateId: FINGERPRINTS_SHA256.leaf,
      privateKeyPem: LEAF_KEY_PEM,
    });

    const pem = expectOk(await api.readPrivateKeyPem(FINGERPRINTS_SHA256.leaf));

    expect(pem).toContain("PRIVATE KEY");
  });

  it("reports a missing key rather than returning an empty string", async () => {
    const { api } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });

    const result = await api.readPrivateKeyPem(FINGERPRINTS_SHA256.leaf);

    expect(result.kind).toBe("Error");
  });

  it("rejects an id that is not a fingerprint", async () => {
    const { api } = buildApi();

    expect((await api.readPrivateKeyPem("../../etc/passwd")).kind).toBe(
      "Error",
    );
  });
});

describe("deletion", () => {
  it("removes the certificate and its key, and orphans its children", async () => {
    const { api, fileSystem } = buildApi();
    await api.importCertificates({ encoded: CHAIN_PEM, source: "Imported" });
    await api.importPrivateKey({
      certificateId: FINGERPRINTS_SHA256.root,
      privateKeyPem: ROOT_KEY_PEM,
    });

    await api.deleteCertificate(FINGERPRINTS_SHA256.root);
    const all = expectOk(await api.listCertificates());

    expect(all).toHaveLength(2);
    expect(
      all.find((entry) => entry.id === FINGERPRINTS_SHA256.intermediate)
        ?.parentId,
    ).toBeUndefined();
    expect(
      fileSystem.files.has(`${ROOT}/keys/${FINGERPRINTS_SHA256.root}.pem`),
    ).toBe(false);
  });

  it("reports deleting something that is already gone", async () => {
    const { api } = buildApi();

    expect((await api.deleteCertificate(FINGERPRINTS_SHA256.leaf)).kind).toBe(
      "Error",
    );
  });
});

describe("backup", () => {
  it("round trips through an empty store", async () => {
    const source = buildApi();
    await source.api.importCertificates({
      encoded: CHAIN_PEM,
      source: "Imported",
    });
    await source.api.importPrivateKey({
      certificateId: FINGERPRINTS_SHA256.leaf,
      privateKeyPem: LEAF_KEY_PEM,
    });

    const backup = expectOk(
      await source.api.exportBackup({ includePrivateKeys: true }),
    );

    const restored = buildApi();
    expectOk(await restored.api.importBackup(backup));
    const all = expectOk(await restored.api.listCertificates());

    expect(all).toHaveLength(3);
    expect(
      all.find((entry) => entry.id === FINGERPRINTS_SHA256.leaf)?.hasPrivateKey,
    ).toBe(true);
  });

  it("omits private keys when the user asks it to", async () => {
    const { api } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });
    await api.importPrivateKey({
      certificateId: FINGERPRINTS_SHA256.leaf,
      privateKeyPem: LEAF_KEY_PEM,
    });

    const backup = expectOk(
      await api.exportBackup({ includePrivateKeys: false }),
    );

    expect(backup).not.toContain("PRIVATE KEY");
    expect(backup).toContain("BEGIN CERTIFICATE");
  });

  it("refuses a backup whose key does not match its certificate", async () => {
    const { api } = buildApi();
    const backup = JSON.stringify({
      format: "saml-raider-certificates",
      version: 1,
      certificates: [
        {
          id: FINGERPRINTS_SHA256.leaf,
          label: "leaf",
          source: "Imported",
          createdAt: "2026-08-04T00:00:00.000Z",
          certificatePem: LEAF_CERTIFICATE_PEM,
          privateKeyPem: ROOT_KEY_PEM,
        },
      ],
    });

    expect((await api.importBackup(backup)).kind).toBe("Error");
  });

  it("refuses a file that is not a backup", async () => {
    const { api } = buildApi();

    expect((await api.importBackup("{}")).kind).toBe("Error");
    expect((await api.importBackup("not json")).kind).toBe("Error");
  });
});

describe("generation", () => {
  it("stores a self-signed certificate with its key", async () => {
    const { api } = buildApi();

    const created = expectOk(
      await api.createSelfSignedCertificate({
        label: "Test authority",
        privateKeyPem: LEAF_KEY_PEM,
        subject: { commonName: "Test authority" },
        validity: {
          notBefore: "2026-01-01T00:00:00.000Z",
          notAfter: "2027-01-01T00:00:00.000Z",
        },
        signatureAlgorithm: "SHA-256",
        isCertificateAuthority: true,
      }),
    );

    expect(created.hasPrivateKey).toBe(true);
  });

  it("refuses a validity window that ends before it starts", async () => {
    const { api } = buildApi();

    const result = await api.createSelfSignedCertificate({
      label: "Backwards",
      privateKeyPem: LEAF_KEY_PEM,
      subject: { commonName: "Backwards" },
      validity: {
        notBefore: "2027-01-01T00:00:00.000Z",
        notAfter: "2026-01-01T00:00:00.000Z",
      },
      signatureAlgorithm: "SHA-256",
      isCertificateAuthority: false,
    });

    expect(result.kind).toBe("Error");
  });

  it("clones a stored certificate under a new identity", async () => {
    const { api } = buildApi();
    await api.importCertificates({
      encoded: INTERMEDIATE_CERTIFICATE_PEM,
      source: "Imported",
    });

    const clone = expectOk(
      await api.cloneCertificate({
        sourceId: FINGERPRINTS_SHA256.intermediate,
        label: "Cloned intermediate",
        privateKeyPem: LEAF_KEY_PEM,
        signatureAlgorithm: "SHA-256",
      }),
    );

    expect(clone.id).not.toBe(FINGERPRINTS_SHA256.intermediate);
    expect(clone.details.subject).toContain("Fixture Intermediate CA");
  });

  it("refuses to clone a chain without a key for every certificate", async () => {
    const { api } = buildApi();
    await api.importCertificates({ encoded: CHAIN_PEM, source: "Imported" });

    const result = await api.cloneCertificateChain({
      sourceId: FINGERPRINTS_SHA256.leaf,
      labelSuffix: " (clone)",
      keys: [
        { sourceId: FINGERPRINTS_SHA256.leaf, privateKeyPem: LEAF_KEY_PEM },
      ],
      signatureAlgorithm: "SHA-256",
    });

    expect(result.kind).toBe("Error");
  });

  it("clones a whole chain when every key is supplied", async () => {
    const { api } = buildApi();
    await api.importCertificates({ encoded: CHAIN_PEM, source: "Imported" });

    const created = expectOk(
      await api.cloneCertificateChain({
        sourceId: FINGERPRINTS_SHA256.leaf,
        labelSuffix: " (clone)",
        keys: [
          { sourceId: FINGERPRINTS_SHA256.leaf, privateKeyPem: LEAF_KEY_PEM },
          {
            sourceId: FINGERPRINTS_SHA256.intermediate,
            privateKeyPem: LEAF_KEY_PEM,
          },
          { sourceId: FINGERPRINTS_SHA256.root, privateKeyPem: ROOT_KEY_PEM },
        ],
        signatureAlgorithm: "SHA-256",
      }),
    );

    expect(created).toHaveLength(3);
    expect(created.every((entry) => entry.label.endsWith(" (clone)"))).toBe(
      true,
    );
  });
});

describe("stored state", () => {
  it("refuses to read a store written by a newer format", async () => {
    const { api, fileSystem } = buildApi();
    await fileSystem.writeTextFile(
      `${ROOT}/certificates.json`,
      JSON.stringify({ version: 99, certificates: [] }),
      0o600,
    );

    const result = await api.listCertificates();

    expect(result.kind).toBe("Error");
    expect(result.kind === "Error" && result.error).toContain("newer version");
  });

  it("leaves an unreadable store on disk rather than replacing it", async () => {
    const { api, fileSystem } = buildApi();
    const path = `${ROOT}/certificates.json`;
    await fileSystem.writeTextFile(path, "{ not json", 0o600);

    await api.listCertificates();

    expect(fileSystem.files.get(path)?.content).toBe("{ not json");
  });

  it("starts empty when nothing has been stored yet", async () => {
    const { api } = buildApi();

    expect(expectOk(await api.listCertificates())).toEqual([]);
  });
});

describe("filesystem failures are not mistaken for missing data", () => {
  it("refuses to report an unreadable store as empty", async () => {
    const { api, fileSystem } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });
    fileSystem.failing.add(`${ROOT}/certificates.json`);

    const result = await api.listCertificates();

    expect(result.kind).toBe("Error");
    expect(result.kind === "Error" && result.error).toContain(
      "could not be read",
    );
  });

  it("refuses to report an unreadable key directory as having no keys", async () => {
    const { api, fileSystem } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });
    fileSystem.failing.add(`${ROOT}/keys`);

    const result = await api.listCertificates();

    expect(result.kind).toBe("Error");
  });

  it("reports a failed key deletion instead of claiming success", async () => {
    const { api, fileSystem } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });
    await api.importPrivateKey({
      certificateId: FINGERPRINTS_SHA256.leaf,
      privateKeyPem: LEAF_KEY_PEM,
    });
    fileSystem.failing.add(`${ROOT}/keys/${FINGERPRINTS_SHA256.leaf}.pem`);

    const result = await api.deleteCertificate(FINGERPRINTS_SHA256.leaf);

    expect(result.kind).toBe("Error");
  });

  it("does not overwrite a store it refused to read", async () => {
    const { api, fileSystem } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });
    const before = fileSystem.files.get(`${ROOT}/certificates.json`)?.content;
    fileSystem.failing.add(`${ROOT}/certificates.json`);

    await api.importCertificates({
      encoded: INTERMEDIATE_CERTIFICATE_PEM,
      source: "Imported",
    });
    fileSystem.failing.delete(`${ROOT}/certificates.json`);

    expect(fileSystem.files.get(`${ROOT}/certificates.json`)?.content).toBe(
      before,
    );
  });
});

describe("mutations are transactional", () => {
  it("removes keys it staged when the index write fails", async () => {
    const { api, fileSystem } = buildApi();
    fileSystem.failingWrites.add(`${ROOT}/certificates.json`);

    const result = await api.createSelfSignedCertificate({
      label: "rollback",
      subject: { commonName: "rollback.example" },
      validity: {
        notBefore: "2026-01-01T00:00:00.000Z",
        notAfter: "2027-01-01T00:00:00.000Z",
      },
      signatureAlgorithm: "SHA-256",
      isCertificateAuthority: false,
      privateKeyPem: LEAF_KEY_PEM,
    });

    expect(result.kind).toBe("Error");
    const orphans = [...fileSystem.files.keys()].filter((name) =>
      name.startsWith(`${ROOT}/keys/`),
    );
    expect(orphans).toEqual([]);
  });

  it("keeps the private key when the index write fails", async () => {
    const { api, fileSystem } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });
    await api.importPrivateKey({
      certificateId: FINGERPRINTS_SHA256.leaf,
      privateKeyPem: LEAF_KEY_PEM,
    });
    fileSystem.failingWrites.add(`${ROOT}/certificates.json`);

    const result = await api.deleteCertificate(FINGERPRINTS_SHA256.leaf);

    expect(result.kind).toBe("Error");
    expect(
      fileSystem.files.has(`${ROOT}/keys/${FINGERPRINTS_SHA256.leaf}.pem`),
    ).toBe(true);
  });

  it("removes a key left behind by an interrupted write on the next commit", async () => {
    const { api, fileSystem, store } = buildApi();
    await store.writePrivateKeyPem(FINGERPRINTS_SHA256.root, ROOT_KEY_PEM);

    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });

    expect(
      fileSystem.files.has(`${ROOT}/keys/${FINGERPRINTS_SHA256.root}.pem`),
    ).toBe(false);
  });

  it("does not lose a record when two imports overlap", async () => {
    const { api } = buildApi();

    await Promise.all([
      api.importCertificates({
        encoded: LEAF_CERTIFICATE_PEM,
        source: "Imported",
      }),
      api.importCertificates({
        encoded: INTERMEDIATE_CERTIFICATE_PEM,
        source: "Imported",
      }),
    ]);

    const all = expectOk(await api.listCertificates());
    expect(all).toHaveLength(2);
  });

  it("commits a cloned chain all at once or not at all", async () => {
    const { api } = buildApi();
    await api.importCertificates({ encoded: CHAIN_PEM, source: "Imported" });

    const result = await api.cloneCertificateChain({
      sourceId: FINGERPRINTS_SHA256.leaf,
      labelSuffix: " (clone)",
      keys: [
        { sourceId: FINGERPRINTS_SHA256.leaf, privateKeyPem: LEAF_KEY_PEM },
        {
          sourceId: FINGERPRINTS_SHA256.intermediate,
          privateKeyPem: LEAF_KEY_PEM,
        },
      ],
      signatureAlgorithm: "SHA-256",
    });

    const all = expectOk(await api.listCertificates());
    expect(result.kind).toBe("Error");
    expect(all).toHaveLength(3);
  });
});

describe("chain links follow signatures, not names", () => {
  it("does not re-parent originals underneath a clone that shares their subject", async () => {
    const { api } = buildApi();
    await api.importCertificates({ encoded: CHAIN_PEM, source: "Imported" });

    await api.cloneCertificate({
      sourceId: FINGERPRINTS_SHA256.intermediate,
      label: "Cloned intermediate",
      privateKeyPem: LEAF_KEY_PEM,
      signatureAlgorithm: "SHA-256",
    });

    const all = expectOk(await api.listCertificates());
    const leaf = all.find((entry) => entry.id === FINGERPRINTS_SHA256.leaf);

    expect(leaf?.parentId).toBe(FINGERPRINTS_SHA256.intermediate);
  });

  it("gives a clone no parent, because nothing stored signed it", async () => {
    const { api } = buildApi();
    await api.importCertificates({ encoded: CHAIN_PEM, source: "Imported" });

    const clone = expectOk(
      await api.cloneCertificate({
        sourceId: FINGERPRINTS_SHA256.leaf,
        label: "Cloned leaf",
        privateKeyPem: LEAF_KEY_PEM,
        signatureAlgorithm: "SHA-256",
      }),
    );

    expect(clone.parentId).toBeUndefined();
  });
});

describe("backup fidelity", () => {
  it("restores labels, provenance and creation time", async () => {
    const source = buildApi();
    await source.api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      label: "My signing certificate",
      source: "Extracted",
    });

    const backup = expectOk(
      await source.api.exportBackup({ includePrivateKeys: false }),
    );

    const restored = buildApi();
    await restored.api.importBackup(backup);
    const all = expectOk(await restored.api.listCertificates());

    expect(all[0]?.label).toBe("My signing certificate");
    expect(all[0]?.source).toBe("Extracted");
    expect(all[0]?.createdAt).toBe("2026-08-04T00:00:00.000Z");
  });

  it("refuses a backup larger than the limit before parsing it", async () => {
    const { api } = buildApi();

    const result = await api.importBackup("x".repeat(17 * 1024 * 1024));

    expect(result.kind).toBe("Error");
    expect(result.kind === "Error" && result.error).toContain("at most");
  });
});

describe("the endpoints that can return key material", () => {
  it("is exactly readPrivateKeyPem and an opted-in backup", async () => {
    const { api } = buildApi();
    await api.importCertificates({
      encoded: LEAF_CERTIFICATE_PEM,
      source: "Imported",
    });
    await api.importPrivateKey({
      certificateId: FINGERPRINTS_SHA256.leaf,
      privateKeyPem: LEAF_KEY_PEM,
    });

    const withoutKeys = expectOk(
      await api.exportBackup({ includePrivateKeys: false }),
    );
    const withKeys = expectOk(
      await api.exportBackup({ includePrivateKeys: true }),
    );
    const listed = JSON.stringify(await api.listCertificates());
    const renamed = JSON.stringify(
      await api.updateCertificateLabel({
        id: FINGERPRINTS_SHA256.leaf,
        label: "renamed",
      }),
    );

    expect(withoutKeys).not.toContain("PRIVATE KEY");
    expect(withKeys).toContain("PRIVATE KEY");
    expect(listed).not.toContain("PRIVATE KEY");
    expect(renamed).not.toContain("PRIVATE KEY");
  });
});
