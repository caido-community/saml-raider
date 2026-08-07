import { computed, ref } from "vue";

import { type CertificateService } from "@/services/certificates";
import { rememberImportedCertificates } from "@/services/imported";
import { notify } from "@/services/notifications";
import { decodeBase64, isAbsent, type Maybe } from "@/utils";

type EmbeddedCertificate = {
  key: number;
  base64: string;
  fingerprintSha256: string;
  isAlreadyStored: boolean;
};

type DialogState =
  | { kind: "Closed" }
  | { kind: "Loading" }
  | { kind: "Reviewing"; rows: EmbeddedCertificate[] }
  | { kind: "Sending"; rows: EmbeddedCertificate[] }
  | { kind: "Failed"; rows: EmbeddedCertificate[]; message: string };

const markSent = (
  rows: EmbeddedCertificate[],
  sent: Set<string>,
): EmbeddedCertificate[] =>
  rows.map((row) =>
    sent.has(row.fingerprintSha256) ? { ...row, isAlreadyStored: true } : row,
  );

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

const readFingerprint = async (base64: string): Promise<Maybe<string>> => {
  const bytes = decodeBase64(base64.replace(/\s+/g, ""));
  if (isAbsent(bytes)) return undefined;

  return toHex(await crypto.subtle.digest("SHA-256", bytes));
};

export const useForm = (
  certificates: () => string[],
  service: CertificateService,
) => {
  const state = ref<DialogState>({ kind: "Closed" });

  let generation = 0;

  const rows = computed(() =>
    state.value.kind === "Closed" || state.value.kind === "Loading"
      ? []
      : state.value.rows,
  );

  const close = () => {
    generation += 1;
    state.value = { kind: "Closed" };
  };

  return {
    state,
    rows,
    close,

    isOpen: computed({
      get: () => state.value.kind !== "Closed",
      set: (next: boolean) => {
        if (!next) close();
      },
    }),

    isBusy: computed(
      () => state.value.kind === "Loading" || state.value.kind === "Sending",
    ),

    message: computed(() =>
      state.value.kind === "Failed" ? state.value.message : "",
    ),

    newCount: computed(
      () => rows.value.filter((row) => !row.isAlreadyStored).length,
    ),

    review: async () => {
      generation += 1;
      const run = generation;
      state.value = { kind: "Loading" };

      const stored = await service.list();
      if (stored.kind === "Error") {
        if (run !== generation) return;
        state.value = { kind: "Failed", rows: [], message: stored.error };
        return;
      }

      const storedIds = new Set(stored.value.map((entry) => entry.id));

      const found: EmbeddedCertificate[] = [];
      for (const [index, base64] of certificates().entries()) {
        const fingerprintSha256 = await readFingerprint(base64);
        if (isAbsent(fingerprintSha256)) continue;

        found.push({
          key: index,
          base64,
          fingerprintSha256,
          isAlreadyStored: storedIds.has(fingerprintSha256),
        });
      }

      if (run !== generation) return;
      state.value = { kind: "Reviewing", rows: found };
    },

    send: async () => {
      const current = rows.value;
      const pending = current.filter((row) => !row.isAlreadyStored);
      generation += 1;
      const run = generation;
      state.value = { kind: "Sending", rows: current };

      const sent = new Set<string>();
      for (const row of pending) {
        const result = await service.importExtractedCertificate(row.base64);
        if (result.kind === "Ok") {
          sent.add(row.fingerprintSha256);
          rememberImportedCertificates(1);
        }

        if (run !== generation) return;
        if (result.kind === "Error") {
          state.value = {
            kind: "Failed",
            rows: markSent(current, sent),
            message: result.error,
          };
          return;
        }
      }

      close();
      notify().showSuccess(
        sent.size === 0
          ? "Every certificate in this message was already stored."
          : `Sent ${sent.size} certificate${sent.size === 1 ? "" : "s"} to the certificate manager.`,
      );
    },
  };
};
