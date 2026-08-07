import { type Certificate } from "shared";
import { computed, type ComputedRef, ref, type Ref } from "vue";

import {
  applyCvePreset,
  applyMatchAndReplace,
  applyXsltPayload,
  applyXsw,
  buildDocumentWithoutAnySignature,
  buildResignedDocument,
  buildSoapWithSaml,
  buildXxePayload,
  CVE_PRESETS,
  type CveId,
  describeResignFailure,
  isXswApplicable,
  type MatchMode,
  parseXml,
  prettyPrintForDisplay,
  readSoapSaml,
  type ResignTarget,
  XSW_VARIANTS,
  type XswVariant,
} from "@/core";
import { type CertificateService } from "@/services/certificates";
import { buildLineDiff, isAbsent, type LineDiff, type Maybe } from "@/utils";

type Stage =
  | { kind: "Idle" }
  | { kind: "Working"; label: string }
  | {
      kind: "Preview";
      label: string;
      xml: string;
      description: string;
      effect: string;
      diff: LineDiff;
    }
  | { kind: "Refused"; reason: string };

type ActionOption = {
  group: string;
  value: string;
  label: string;
  note: string;
  needsCertificate: boolean;
};

const ACTIONS: ReadonlyArray<ActionOption> = [
  ...XSW_VARIANTS.map(
    (value): ActionOption => ({
      group: "Signature wrapping",
      value,
      label: value,
      note: "",
      needsCertificate: false,
    }),
  ),
  {
    group: "Signatures",
    value: "RemoveSignatures",
    label: "Remove all signatures",
    note: "",
    needsCertificate: false,
  },
  {
    group: "Signatures",
    value: "ResignAssertion",
    label: "Re-sign the assertion",
    note: "",
    needsCertificate: true,
  },
  {
    group: "Signatures",
    value: "ResignMessage",
    label: "Re-sign the message",
    note: "",
    needsCertificate: true,
  },
  ...CVE_PRESETS.map(
    (preset): ActionOption => ({
      group: "Known CVEs",
      value: preset.id,
      label: preset.id,
      note: preset.label,
      needsCertificate: false,
    }),
  ),
];

export type AttacksForm = {
  stage: Ref<Stage>;
  signingCertificates: Ref<Certificate[]>;
  certificateId: Ref<string>;
  callbackUrl: Ref<string>;
  search: Ref<string>;
  replacement: Ref<string>;
  matchMode: Ref<MatchMode>;
  loadCertificates: () => Promise<void>;
  groups: ComputedRef<
    Array<{ label: string; items: Array<ActionOption & { reason: string }> }>
  >;
  wrapping: Ref<Maybe<XswVariant>>;
  cve: Ref<Maybe<CveId>>;
  payload: Ref<"Xxe" | "Xslt">;
  runWrapping: () => void;
  runCve: () => void;
  runPayload: () => void;
  previewXsw: (variant: XswVariant) => void;
  previewCve: (id: CveId) => void;
  previewReplace: () => void;
  previewXxe: () => void;
  previewXslt: () => void;
  previewRemoveSignatures: () => void;
  previewResign: (target: ResignTarget) => Promise<void>;
  confirm: () => void;
  discard: () => void;
};

const readable = (xml: string): string => {
  const parsed = parseXml(xml);
  return parsed.kind === "Ok" ? prettyPrintForDisplay(parsed.document) : xml;
};

const summarize = (before: string, after: string): LineDiff =>
  buildLineDiff(readable(before), readable(after));

export const useForm = (
  current: () => string,
  service: CertificateService,
  apply: (xml: string) => void,
): AttacksForm => {
  const stage = ref<Stage>({ kind: "Idle" });
  const signingCertificates = ref<Certificate[]>([]);
  const certificateId = ref("");
  const callbackUrl = ref("");
  const search = ref("");
  const replacement = ref("");
  const matchMode = ref<MatchMode>("ExactTextNode");
  const wrapping = ref<Maybe<XswVariant>>(undefined);
  const cve = ref<Maybe<CveId>>(undefined);
  const payload = ref<"Xxe" | "Xslt">("Xxe");

  const readDocument = (): Maybe<Document> => {
    const parsed = parseXml(readSoapSaml(current()) ?? current());
    return parsed.kind === "Ok" ? parsed.document : undefined;
  };

  const rewrap = (xml: string): Maybe<string> => {
    if (isAbsent(readSoapSaml(current()))) return xml;

    const wrapped = buildSoapWithSaml(current(), xml);
    return wrapped.kind === "Ok" ? wrapped.xml : undefined;
  };

  const present = (
    label: string,
    xml: string,
    description: string,
    effect: string,
  ) => {
    const full = rewrap(xml);
    if (isAbsent(full)) {
      stage.value = {
        kind: "Refused",
        reason: "the SOAP envelope could not be rebuilt around the change",
      };
      return;
    }

    stage.value = {
      kind: "Preview",
      label,
      xml: full,
      description,
      effect,
      diff: summarize(current(), full),
    };
  };

  const refuse = (reason: string) => {
    stage.value = { kind: "Refused", reason };
  };

  const reasonFor = (option: ActionOption): string => {
    const document = readDocument();
    if (isAbsent(document)) return "this message is not valid XML";

    if (option.group === "Signature wrapping") {
      return isXswApplicable(document, option.value as XswVariant)
        ? ""
        : "this message has no signature at the level this variant rewrites";
    }

    if (option.group === "Known CVEs") {
      const outcome = applyCvePreset(document, option.value as CveId);
      return outcome.kind === "Ok" ? "" : outcome.reason;
    }

    if (option.needsCertificate && signingCertificates.value.length === 0) {
      return "no certificate in the manager has a private key";
    }

    return "";
  };

  const form: AttacksForm = {
    stage,
    signingCertificates,
    certificateId,
    callbackUrl,
    search,
    replacement,
    matchMode,

    groups: computed(() => {
      const decorated = ACTIONS.map((option) => ({
        ...option,
        reason: reasonFor(option),
      }));

      return [...new Set(ACTIONS.map((option) => option.group))].map(
        (label) => ({
          label,
          items: decorated.filter((option) => option.group === label),
        }),
      );
    }),

    wrapping,
    cve,
    payload,

    runWrapping: () => {
      if (isAbsent(wrapping.value)) return refuse("choose a wrapping variant");
      form.previewXsw(wrapping.value);
    },

    runCve: () => {
      if (isAbsent(cve.value)) return refuse("choose a published issue");
      form.previewCve(cve.value);
    },

    runPayload: () =>
      payload.value === "Xxe" ? form.previewXxe() : form.previewXslt(),

    loadCertificates: async () => {
      const listed = await service.list();
      if (listed.kind === "Error") {
        refuse(listed.error);
        return;
      }

      signingCertificates.value = listed.value.filter(
        (certificate) => certificate.hasPrivateKey,
      );
      certificateId.value = signingCertificates.value[0]?.id ?? "";
    },

    previewXsw: (variant: XswVariant) => {
      const document = readDocument();
      if (isAbsent(document)) return refuse("this message is not valid XML");

      if (!isXswApplicable(document, variant)) {
        return refuse(`${variant} does not apply to this message`);
      }

      const outcome = applyXsw(document, variant);
      if (outcome.kind !== "Ok") return refuse(outcome.reason);

      present(
        variant,
        outcome.xml,
        outcome.description,
        "The signature still covers the original element. A service provider that reads a different one accepts attacker-controlled content.",
      );
    },

    previewCve: (id: CveId) => {
      const document = readDocument();
      if (isAbsent(document)) return refuse("this message is not valid XML");

      const outcome = applyCvePreset(document, id);
      if (outcome.kind !== "Ok") return refuse(outcome.reason);

      present(id, outcome.xml, outcome.description, outcome.effect);
    },

    previewReplace: () => {
      const document = readDocument();
      if (isAbsent(document)) return refuse("this message is not valid XML");

      const outcome = applyMatchAndReplace(document, {
        mode: matchMode.value,
        search: search.value,
        replacement: replacement.value,
      });
      if (outcome.kind !== "Ok") return refuse(outcome.reason);
      if (outcome.matches === 0) return refuse("nothing matched that search");

      present(
        "Match and replace",
        outcome.xml,
        outcome.description,
        "Any signature over the changed element no longer matches its digest.",
      );
    },

    previewXxe: () => {
      const outcome = buildXxePayload(
        readSoapSaml(current()) ?? current(),
        callbackUrl.value,
      );
      if (outcome.kind !== "Ok") return refuse(outcome.reason);

      present("XXE", outcome.xml, outcome.description, outcome.effect);
    },

    previewXslt: () => {
      const document = readDocument();
      if (isAbsent(document)) return refuse("this message is not valid XML");

      const outcome = applyXsltPayload(document, callbackUrl.value);
      if (outcome.kind !== "Ok") return refuse(outcome.reason);

      present("XSLT", outcome.xml, outcome.description, outcome.effect);
    },

    previewRemoveSignatures: () => {
      const document = readDocument();
      if (isAbsent(document)) return refuse("this message is not valid XML");

      present(
        "Remove signatures",
        buildDocumentWithoutAnySignature(document),
        "Removed every signature from the message.",
        "A service provider that requires a signature rejects this. One that does not is accepting unsigned assertions.",
      );
    },

    previewResign: async (target: ResignTarget) => {
      const document = readDocument();
      if (isAbsent(document)) return refuse("this message is not valid XML");

      const certificate = signingCertificates.value.find(
        (entry) => entry.id === certificateId.value,
      );
      if (isAbsent(certificate)) {
        return refuse("choose a certificate that has a private key");
      }

      stage.value = { kind: "Working", label: `Re-signing the ${target}` };

      const outcome = await buildResignedDocument({
        document,
        target,
        policy: {
          certificate,
          signatureAlgorithm: "SHA-256",
          digestAlgorithm: "SHA-256",
          isRemovingExistingSignatures: true,
        },
        sign: (input) =>
          service.signSignedInfo({
            certificateId: certificate.id,
            signedInfoBase64: input.signedInfoBase64,
            signatureAlgorithm: input.signatureAlgorithm,
          }),
        verify: service.verifySignature,
      });

      if (outcome.kind !== "Ok") {
        return refuse(describeResignFailure(outcome.failure));
      }

      present(
        `Re-sign ${target}`,
        outcome.xml,
        `Signed the ${target} with ${certificate.label}.`,
        "The signature is only trusted if the service provider trusts this certificate.",
      );
    },

    confirm: () => {
      const shown = stage.value;
      if (shown.kind !== "Preview") return;

      stage.value = { kind: "Idle" };
      apply(shown.xml);
    },

    discard: () => {
      stage.value = { kind: "Idle" };
    },
  };

  return form;
};
