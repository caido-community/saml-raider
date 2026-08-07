import type { SDK } from "caido:plugin";
import type { API, Spec } from "shared";
import { describe, expect, it } from "vitest";

import { init } from "./index";

const EVERY_ENDPOINT: Record<keyof API, true> = {
  listCertificates: true,
  importCertificates: true,
  importPrivateKey: true,
  updateCertificateLabel: true,
  deleteCertificate: true,
  createSelfSignedCertificate: true,
  cloneCertificate: true,
  cloneCertificateChain: true,
  exportBackup: true,
  importBackup: true,
  readPrivateKeyPem: true,
  signSignedInfo: true,
  verifySignature: true,
  getParameterNames: true,
  setParameterNames: true,
  getHighlightSettings: true,
  setHighlightSettings: true,
};

const readRegisteredNames = (): string[] => {
  const registered: string[] = [];

  const sdk = {
    meta: { path: () => "/tmp/saml-raider-spec" },
    api: {
      register: (name: string) => {
        registered.push(name);
      },
      send: () => undefined,
    },
    events: { onInterceptRequest: () => undefined },
  };

  init(sdk as unknown as SDK<Spec>);
  return registered;
};

describe("the backend RPC surface", () => {
  it("registers every endpoint the shared contract declares", () => {
    expect(readRegisteredNames().sort()).toStrictEqual(
      Object.keys(EVERY_ENDPOINT).sort(),
    );
  });

  it("registers each endpoint exactly once", () => {
    const names = readRegisteredNames();

    expect(names).toHaveLength(new Set(names).size);
  });
});
