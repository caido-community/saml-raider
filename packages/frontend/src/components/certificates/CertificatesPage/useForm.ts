import {
  type Certificate,
  err,
  ok,
  readErrorMessage,
  type Result,
  type SignatureAlgorithm,
} from "shared";
import { computed, onMounted, ref } from "vue";

import { readPemOrDerFile } from "@/components/certificates/files";
import {
  type CertificateService,
  type SelfSignedRequest,
} from "@/services/certificates";
import { type NotificationSink } from "@/types";
import { downloadText, isAbsent, isPresent, type Maybe } from "@/utils";

type PageState =
  | { kind: "Loading" }
  | { kind: "Failed"; message: string }
  | { kind: "Ready"; certificates: Certificate[] };

type Operation =
  | { kind: "Idle" }
  | {
      kind: "Running";
      name:
        | "Refresh"
        | "Import"
        | "Create"
        | "Rename"
        | "Delete"
        | "Clone"
        | "CloneChain"
        | "AttachKey"
        | "ExportCertificate"
        | "ExportKey";
    };

const DEFAULT_ALGORITHM: SignatureAlgorithm = "SHA-256";

const buildFileName = (label: string, extension: string): string => {
  const safeLabel = label
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "");
  return (safeLabel === "" ? "certificate" : safeLabel) + "." + extension;
};

export const useForm = (options: {
  service: CertificateService;
  notifications: NotificationSink;
}) => {
  const { service, notifications } = options;

  const page = ref<PageState>({ kind: "Loading" });
  const filter = ref("");
  const selectedId = ref<Maybe<string>>(undefined);
  const operation = ref<Operation>({ kind: "Idle" });
  const isCreateOpen = ref(false);
  const certificateInput = ref<HTMLInputElement | undefined>(undefined);

  const certificates = computed(() =>
    page.value.kind === "Ready" ? page.value.certificates : [],
  );
  const certificateCount = computed(() => certificates.value.length);
  const selected = computed(() =>
    certificates.value.find((entry) => entry.id === selectedId.value),
  );
  const isBusy = computed(() => operation.value.kind === "Running");
  const isRefreshing = computed(
    () =>
      operation.value.kind === "Running" && operation.value.name === "Refresh",
  );

  const run = async <T>(
    name: Extract<Operation, { kind: "Running" }>["name"],
    errorPrefix: string,
    action: () => Promise<Result<T>>,
  ): Promise<Result<T>> => {
    if (operation.value.kind === "Running") {
      return err("Another certificate operation is already running.");
    }

    operation.value = { kind: "Running", name };
    try {
      const result = await action();
      if (result.kind === "Error") {
        notifications.showError(errorPrefix + ": " + result.error);
      }
      return result;
    } catch (error) {
      const message = readErrorMessage(error);
      notifications.showError(errorPrefix + ": " + message);
      return err<T>(message);
    } finally {
      operation.value = { kind: "Idle" };
    }
  };

  const refresh = async (showLoading = false) => {
    const previousPage = page.value;
    if (showLoading || previousPage.kind !== "Ready") {
      page.value = { kind: "Loading" };
    }

    const result = await run("Refresh", "Unable to load certificates", () =>
      service.list(),
    );
    if (result.kind === "Error") {
      if (previousPage.kind !== "Ready") {
        page.value = { kind: "Failed", message: result.error };
      }
      return;
    }

    page.value = { kind: "Ready", certificates: result.value };
    if (isPresent(selectedId.value) && isAbsent(selected.value)) {
      selectedId.value = undefined;
    }
  };

  const runMutation = async <T>(
    name: Extract<Operation, { kind: "Running" }>["name"],
    errorPrefix: string,
    successMessage: string,
    action: () => Promise<Result<T>>,
  ): Promise<boolean> => {
    const result = await run(name, errorPrefix, action);
    if (result.kind === "Error") return false;

    notifications.showSuccess(successMessage);
    await refresh();
    return true;
  };

  const importCertificate = async (encoded: string, label: string) => {
    const result = await run("Import", "Certificate import failed", () =>
      service.importCertificates(encoded, label === "" ? undefined : label),
    );
    if (result.kind === "Error") return;

    const added = result.value.filter((entry) => !entry.wasAlreadyStored);
    const duplicateCount = result.value.length - added.length;
    const duplicateMessage =
      duplicateCount === 0
        ? ""
        : ", " + String(duplicateCount) + " already stored";

    notifications.showSuccess(
      "Imported " +
        String(added.length) +
        " certificate" +
        (added.length === 1 ? "" : "s") +
        duplicateMessage +
        ".",
    );
    await refresh();

    const first = added[0] ?? result.value[0];
    if (isPresent(first)) selectedId.value = first.certificate.id;
  };

  const onCertificateFile = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (isAbsent(file)) return;

    try {
      const encoded = await readPemOrDerFile(file);
      await importCertificate(encoded, file.name.replace(/\.[^.]+$/, ""));
    } catch (error) {
      notifications.showError(
        "Unable to read the certificate file: " + readErrorMessage(error),
      );
    } finally {
      input.value = "";
    }
  };

  const exportSelectedCertificate = async () => {
    const certificate = selected.value;
    if (isAbsent(certificate)) return;

    const result = await run(
      "ExportCertificate",
      "Certificate export failed",
      () => {
        downloadText(
          buildFileName(certificate.label, "crt.pem"),
          certificate.certificatePem,
        );
        return Promise.resolve(ok(undefined));
      },
    );
    if (result.kind === "Ok") {
      notifications.showSuccess('Exported "' + certificate.label + '".');
    }
  };

  const exportSelectedPrivateKey = async () => {
    const certificate = selected.value;
    if (isAbsent(certificate)) return;

    const result = await run(
      "ExportKey",
      "Private key export failed",
      async () => {
        const privateKey = await service.readPrivateKeyPem(certificate.id);
        if (privateKey.kind === "Error") return privateKey;

        downloadText(
          buildFileName(certificate.label, "key.pem"),
          privateKey.value,
        );
        return ok(undefined);
      },
    );
    if (result.kind === "Ok") {
      notifications.showSuccess(
        'Exported the private key for "' + certificate.label + '".',
      );
    }
  };

  const attachPrivateKeyToSelected = async (pem: string) => {
    const certificate = selected.value;
    if (isAbsent(certificate)) return;

    await runMutation(
      "AttachKey",
      "Private key import failed",
      'Attached a private key to "' + certificate.label + '".',
      () => service.importPrivateKey(certificate.id, pem),
    );
  };

  const renameSelected = async (label: string) => {
    const certificate = selected.value;
    if (isAbsent(certificate)) return;

    await runMutation(
      "Rename",
      "Certificate rename failed",
      'Renamed "' + certificate.label + '" to "' + label + '".',
      () => service.rename(certificate.id, label),
    );
  };

  const removeSelected = async () => {
    const certificate = selected.value;
    if (isAbsent(certificate)) return;

    const removed = await runMutation(
      "Delete",
      "Certificate deletion failed",
      'Deleted "' + certificate.label + '".',
      () => service.remove(certificate.id),
    );
    if (removed) selectedId.value = undefined;
  };

  const cloneSelected = async () => {
    const certificate = selected.value;
    if (isAbsent(certificate)) return;

    await runMutation(
      "Clone",
      "Certificate clone failed",
      'Cloned "' + certificate.label + '".',
      () =>
        service.clone(
          certificate.id,
          certificate.label + " (clone)",
          DEFAULT_ALGORITHM,
        ),
    );
  };

  const cloneSelectedChain = async () => {
    const certificate = selected.value;
    if (isAbsent(certificate)) return;

    await runMutation(
      "CloneChain",
      "Certificate chain clone failed",
      'Cloned the chain for "' + certificate.label + '".',
      () =>
        service.cloneChain(
          certificates.value,
          certificate.id,
          DEFAULT_ALGORITHM,
        ),
    );
  };

  const createSelfSigned = (input: SelfSignedRequest) =>
    runMutation(
      "Create",
      "Certificate creation failed",
      'Created "' + input.label + '".',
      () => service.createSelfSigned(input),
    );

  onMounted(() => refresh(true));

  return {
    page,
    filter,
    selectedId,
    selected,
    certificates,
    isEmpty: computed(() => certificateCount.value === 0),
    certificateCount,
    detailPlaceholder: computed(() =>
      certificateCount.value === 0
        ? {
            title: "No certificates",
            message:
              "Import a certificate, or create a self-signed one to sign SAML messages with.",
          }
        : {
            title: "No certificate selected",
            message: "Select a certificate to inspect its fields and key.",
          },
    ),
    isBusy,
    isRefreshing,
    isCreateOpen,
    refresh: () => refresh(),
    applyFilter: (value: string | undefined) => {
      filter.value = value ?? "";
    },
    clearFilter: () => {
      filter.value = "";
    },
    select: (id: string) => {
      selectedId.value = id;
    },
    openCertificatePicker: () => certificateInput.value?.click(),
    setCertificateInput: (element: unknown) => {
      if (element instanceof HTMLInputElement) {
        certificateInput.value = element;
      }
    },
    openCreateDialog: () => {
      isCreateOpen.value = true;
    },
    onCertificateFile,
    exportSelectedCertificate,
    exportSelectedPrivateKey,
    attachPrivateKeyToSelected,
    renameSelected,
    removeSelected,
    cloneSelected,
    cloneSelectedChain,
    createSelfSigned,
    reportError: notifications.showError,
  };
};
