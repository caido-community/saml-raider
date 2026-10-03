import { readErrorMessage } from "shared";
import { computed, ref } from "vue";

import { type CertificateService } from "@/services/certificates";
import { type NotificationSink } from "@/types";
import { downloadText, isAbsent, type Maybe } from "@/utils";

type Operation =
  | { kind: "Idle" }
  | { kind: "Exporting" }
  | { kind: "Restoring" };

export const useForm = (options: {
  service: CertificateService;
  notifications: NotificationSink;
}) => {
  const operation = ref<Operation>({ kind: "Idle" });
  const error = ref<Maybe<string>>(undefined);
  const isExportOpen = ref(false);
  const backupInput = ref<HTMLInputElement | undefined>(undefined);

  const exportBackup = async (includePrivateKeys: boolean) => {
    if (operation.value.kind !== "Idle") return;

    operation.value = { kind: "Exporting" };
    error.value = undefined;
    try {
      const result = await options.service.exportBackup(includePrivateKeys);
      if (result.kind === "Error") {
        error.value = result.error;
        options.notifications.showError(
          "Certificate backup failed: " + result.error,
        );
        return;
      }

      downloadText("saml-raider-certificates.json", result.value);
      isExportOpen.value = false;
      options.notifications.showSuccess("Certificate backup exported.");
    } catch (cause) {
      error.value = readErrorMessage(cause);
      options.notifications.showError(
        "Certificate backup failed: " + error.value,
      );
    } finally {
      operation.value = { kind: "Idle" };
    }
  };

  const restoreBackup = async (file: File) => {
    if (operation.value.kind !== "Idle") return;

    operation.value = { kind: "Restoring" };
    error.value = undefined;
    try {
      const result = await options.service.importBackup(await file.text());
      if (result.kind === "Error") {
        error.value = result.error;
        options.notifications.showError(
          "Certificate restore failed: " + result.error,
        );
        return;
      }

      const addedCount = result.value.filter(
        (entry) => !entry.wasAlreadyStored,
      ).length;
      const existingCount = result.value.length - addedCount;
      const existingMessage =
        existingCount === 0
          ? ""
          : " " + String(existingCount) + " already existed.";

      options.notifications.showSuccess(
        "Restored " +
          String(addedCount) +
          " certificate" +
          (addedCount === 1 ? "." : "s.") +
          existingMessage,
      );
    } catch (cause) {
      error.value = readErrorMessage(cause);
      options.notifications.showError(
        "Certificate restore failed: " + error.value,
      );
    } finally {
      operation.value = { kind: "Idle" };
    }
  };

  const onBackupFile = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (isAbsent(file)) return;

    await restoreBackup(file);
    input.value = "";
  };

  return {
    error,
    isExportOpen,
    isBusy: computed(() => operation.value.kind !== "Idle"),
    isExporting: computed(() => operation.value.kind === "Exporting"),
    isRestoring: computed(() => operation.value.kind === "Restoring"),
    openExport: () => {
      error.value = undefined;
      isExportOpen.value = true;
    },
    openRestore: () => backupInput.value?.click(),
    setBackupInput: (element: unknown) => {
      if (element instanceof HTMLInputElement) backupInput.value = element;
    },
    onBackupFile,
    exportBackup,
  };
};
