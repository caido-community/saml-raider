import type { SDK } from "caido:plugin";
import type { Spec } from "shared";

import { buildCertificateApi } from "./certificates/api";
import { buildCertificateStore } from "./certificates/store";
import { buildPreferencesApi } from "./preferences/api";
import { buildFileSystem } from "./runtime/fileSystem";

export function init(sdk: SDK<Spec>) {
  const fileSystem = buildFileSystem();
  const root = sdk.meta.path();

  const certificates = buildCertificateApi(
    buildCertificateStore(fileSystem, root),
    () => new Date().toISOString(),
  );

  const preferences = buildPreferencesApi(fileSystem, root);

  sdk.api.register("listCertificates", () => certificates.listCertificates());
  sdk.api.register("importCertificates", (_sdk, input) =>
    certificates.importCertificates(input),
  );
  sdk.api.register("importPrivateKey", (_sdk, input) =>
    certificates.importPrivateKey(input),
  );
  sdk.api.register("updateCertificateLabel", (_sdk, input) =>
    certificates.updateCertificateLabel(input),
  );
  sdk.api.register("deleteCertificate", (_sdk, id) =>
    certificates.deleteCertificate(id),
  );
  sdk.api.register("createSelfSignedCertificate", (_sdk, input) =>
    certificates.createSelfSignedCertificate(input),
  );
  sdk.api.register("cloneCertificate", (_sdk, input) =>
    certificates.cloneCertificate(input),
  );
  sdk.api.register("cloneCertificateChain", (_sdk, input) =>
    certificates.cloneCertificateChain(input),
  );
  sdk.api.register("exportBackup", (_sdk, input) =>
    certificates.exportBackup(input),
  );
  sdk.api.register("importBackup", (_sdk, json) =>
    certificates.importBackup(json),
  );
  sdk.api.register("readPrivateKeyPem", (_sdk, id) =>
    certificates.readPrivateKeyPem(id),
  );

  sdk.api.register("getParameterNames", () => preferences.getParameterNames());
  sdk.api.register("setParameterNames", (_sdk, input) =>
    preferences.setParameterNames(input),
  );
}
