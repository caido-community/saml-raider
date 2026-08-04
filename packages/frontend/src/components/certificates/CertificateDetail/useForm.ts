import { type Certificate, readErrorMessage } from "shared";
import { computed, type MaybeRefOrGetter, ref, toValue } from "vue";

import { readPemOrDerFile } from "@/components/certificates/files";
import { useConfirm } from "@/composables/useConfirm";
import { formatHex, isAbsent, isPresent, type Maybe } from "@/utils";

type DetailField = { label: string; value: string };

type DetailGroup = { title: string; fields: DetailField[]; isSigned: boolean };

type Badge = { label: string; icon?: string; className: string };

type Popup = { toggle: (event: Event) => void };

type ExpiryNotice =
  | { kind: "Expired"; message: string }
  | { kind: "NotYetValid"; message: string }
  | { kind: "Valid" };

type DetailEmit = {
  (event: "rename", label: string): void;
  (event: "remove"): void;
  (event: "clone"): void;
  (event: "cloneChain"): void;
  (event: "exportCertificate"): void;
  (event: "exportPrivateKey"): void;
  (event: "attachPrivateKey", pem: string): void;
  (event: "error", message: string): void;
};

const ABSENT = "Not available";

const format = (value: Maybe<string>): string =>
  isAbsent(value) || value === "" ? ABSENT : value;

const formatList = (values: string[]): string =>
  values.length === 0 ? ABSENT : values.join(", ");

const formatDate = (value: string): string => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toUTCString();
};

export const useForm = (options: {
  certificate: MaybeRefOrGetter<Certificate>;
  emit: DetailEmit;
}) => {
  const confirm = useConfirm();
  const isRenameOpen = ref(false);
  const moreMenu = ref<Maybe<Popup>>(undefined);
  const keyInput = ref<HTMLInputElement | undefined>(undefined);

  const groups = computed<DetailGroup[]>(() => {
    const certificate = toValue(options.certificate);
    const details = certificate.details;

    return [
      {
        title: "Storage",
        isSigned: false,
        fields: [
          { label: "Name", value: certificate.label },
          { label: "Source", value: certificate.source },
          { label: "Added", value: formatDate(certificate.createdAt) },
        ],
      },
      {
        title: "Identity and validity",
        isSigned: true,
        fields: [
          { label: "Version", value: String(details.version) },
          { label: "Serial number", value: formatHex(details.serialNumberHex) },
          { label: "Signature algorithm", value: details.signatureAlgorithm },
          { label: "Issuer", value: details.issuer },
          { label: "Subject", value: details.subject },
          { label: "Valid from", value: formatDate(details.notBefore) },
          { label: "Valid until", value: formatDate(details.notAfter) },
          { label: "Self-signed", value: details.isSelfSigned ? "Yes" : "No" },
          {
            label: "Certificate signature",
            value: formatHex(details.signatureHex),
          },
        ],
      },
      {
        title: "Public key",
        isSigned: true,
        fields: [
          { label: "Algorithm", value: details.publicKeyAlgorithm },
          { label: "Key size", value: String(details.keySizeBits) + " bits" },
          { label: "Exponent", value: String(details.publicExponent) },
          { label: "Modulus", value: formatHex(details.modulusHex) },
        ],
      },
      {
        title: "Constraints and usage",
        isSigned: true,
        fields: [
          {
            label: "Certificate authority",
            value: isAbsent(details.basicConstraints)
              ? ABSENT
              : details.basicConstraints.isCertificateAuthority
                ? "Yes"
                : "No",
          },
          {
            label: "Path length",
            value:
              details.basicConstraints?.pathLength === undefined
                ? ABSENT
                : String(details.basicConstraints.pathLength),
          },
          { label: "Key usage", value: formatList(details.keyUsage) },
          {
            label: "Key usage critical",
            value: details.isKeyUsageCritical ? "Yes" : "No",
          },
          {
            label: "Extended key usage",
            value: formatList(details.extendedKeyUsage),
          },
        ],
      },
      {
        title: "Names and identifiers",
        isSigned: true,
        fields: [
          {
            label: "Subject alternative names",
            value: formatList(details.subjectAlternativeNames),
          },
          {
            label: "Issuer alternative names",
            value: formatList(details.issuerAlternativeNames),
          },
          {
            label: "Subject key identifier",
            value: format(
              isPresent(details.subjectKeyIdentifier)
                ? formatHex(details.subjectKeyIdentifier)
                : undefined,
            ),
          },
          {
            label: "Authority key identifier",
            value: format(
              isPresent(details.authorityKeyIdentifier)
                ? formatHex(details.authorityKeyIdentifier)
                : undefined,
            ),
          },
        ],
      },
      {
        title: "Fingerprints",
        isSigned: true,
        fields: [
          { label: "SHA-256", value: formatHex(details.fingerprintSha256) },
          { label: "SHA-1", value: formatHex(details.fingerprintSha1) },
        ],
      },
      {
        title: "Other extensions",
        isSigned: true,
        fields:
          details.unsupportedExtensions.length === 0
            ? [{ label: "Extensions", value: ABSENT }]
            : details.unsupportedExtensions.map((extension) => ({
                label: extension.oid,
                value:
                  (extension.isCritical ? "Critical, " : "") +
                  "copied when cloning",
              })),
      },
    ];
  });

  const expiry = computed<ExpiryNotice>(() => {
    const details = toValue(options.certificate).details;
    const now = Date.now();

    if (Date.parse(details.notAfter) < now) {
      return {
        kind: "Expired",
        message: "Expired on " + formatDate(details.notAfter),
      };
    }
    if (Date.parse(details.notBefore) > now) {
      return {
        kind: "NotYetValid",
        message: "Valid from " + formatDate(details.notBefore),
      };
    }
    return { kind: "Valid" };
  });

  const validityBadge = computed(() => {
    if (expiry.value.kind === "Expired") {
      return {
        label: "Expired",
        icon: "fas fa-clock",
        className: "border-red-500/40 bg-red-500/10 text-red-300",
      };
    }
    if (expiry.value.kind === "NotYetValid") {
      return {
        label: "Not yet valid",
        icon: "fas fa-clock",
        className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      };
    }
    return {
      label: "Valid",
      icon: "fas fa-circle-check",
      className: "border-green-500/40 bg-green-500/10 text-green-300",
    };
  });

  const badges = computed<Badge[]>(() => {
    const certificate = toValue(options.certificate);

    return [
      {
        label: certificate.source,
        className: "border-surface-600 bg-surface-700/30 text-surface-300",
      },
      certificate.hasPrivateKey
        ? {
            label: "Private key available",
            icon: "fas fa-key",
            className: "border-green-500/40 bg-green-500/10 text-green-300",
          }
        : {
            label: "No private key",
            icon: "fas fa-key",
            className: "border-surface-600 bg-surface-700/30 text-surface-400",
          },
      validityBadge.value,
    ];
  });

  const onKeyFile = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (isAbsent(file)) return;

    try {
      options.emit("attachPrivateKey", await readPemOrDerFile(file));
    } catch (error) {
      options.emit(
        "error",
        "Unable to read the private key file: " + readErrorMessage(error),
      );
    } finally {
      input.value = "";
    }
  };

  return {
    groups,
    expiry,
    isRenameOpen,
    setKeyInput: (element: unknown) => {
      if (element instanceof HTMLInputElement) keyInput.value = element;
    },
    hasPrivateKey: computed(() => toValue(options.certificate).hasPrivateKey),
    badges,
    openRename: () => {
      isRenameOpen.value = true;
    },
    rename: (label: string) => {
      isRenameOpen.value = false;
      options.emit("rename", label);
    },
    setMoreMenu: (instance: unknown) => {
      moreMenu.value = instance as Maybe<Popup>;
    },
    toggleMore: (event: Event) => moreMenu.value?.toggle(event),
    moreActions: computed(() => [
      {
        label: "Clone certificate",
        icon: "fas fa-copy",
        command: () => options.emit("clone"),
      },
      {
        label: "Clone certificate chain",
        icon: "fas fa-sitemap",
        command: () => options.emit("cloneChain"),
      },
    ]),
    exportCertificate: () => options.emit("exportCertificate"),
    attachPrivateKey: () => keyInput.value?.click(),
    confirmRemove: () =>
      confirm.require({
        header: "Delete certificate",
        message:
          'Delete "' +
          toValue(options.certificate).label +
          '" and its stored private key?\nThis cannot be undone.',
        acceptLabel: "Delete",
        isDestructive: true,
        accept: () => options.emit("remove"),
      }),
    confirmExportPrivateKey: () =>
      confirm.require({
        header: "Export private key",
        message:
          'Export the private key for "' +
          toValue(options.certificate).label +
          '" to an unencrypted file?\nAnyone who can read it can sign as this certificate.',
        acceptLabel: "Export key",
        accept: () => options.emit("exportPrivateKey"),
      }),
    onKeyFile,
  };
};
