import type { SDK } from "caido:plugin";
import type { Spec } from "shared";

import { buildCertificateApi } from "./certificates/api";
import { buildCertificateStore } from "./certificates/store";
import { looksLikeSaml } from "./detection";
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
  sdk.api.register("signSignedInfo", (_sdk, input) =>
    certificates.signSignedInfo(input),
  );
  sdk.api.register("verifySignature", (_sdk, input) =>
    certificates.verifySignature(input),
  );

  sdk.api.register("getParameterNames", () => preferences.getParameterNames());
  sdk.api.register("setParameterNames", (_sdk, input) =>
    preferences.setParameterNames(input),
  );
  sdk.api.register("getHighlightSettings", () =>
    preferences.getHighlightSettings(),
  );
  sdk.api.register("setHighlightSettings", (_sdk, input) =>
    preferences.setHighlightSettings(input),
  );

  sdk.events.onInterceptRequest(async (_sdk, request) => {
    const highlight = await preferences.getHighlightSettings();
    if (highlight.kind === "Error" || !highlight.value.isEnabled) return;

    const names = await preferences.getParameterNames();
    if (names.kind === "Error") return;

    if (!looksLikeSaml(request.getRaw().toText(), names.value)) return;

    sdk.api.send("samlDetected", request.getId());
  });
}
