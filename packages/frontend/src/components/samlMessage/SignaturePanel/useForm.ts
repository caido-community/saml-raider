import { computed, type ComputedRef, ref, type Ref } from "vue";

import {
  parseXml,
  readSignatureLocations,
  readSignatures,
  readWrappingRisk,
  type UnverifiableReason,
  type VerificationOutcome,
  verifySignature,
  type WrappingRisk,
} from "@/core";
import { type CertificateService } from "@/services/certificates";
import { isAbsent } from "@/utils";

type Tone = "Good" | "Bad" | "Unknown";

type SignatureRow = {
  index: number;
  coveredId: string;
  parentPath: string;
  label: string;
  detail: string;
  tone: Tone;
};

type PanelState =
  | { kind: "Idle" }
  | { kind: "Checking" }
  | { kind: "Ready"; rows: SignatureRow[]; risk: WrappingRisk }
  | { kind: "Unparseable" };

export type SignaturePanelForm = {
  state: Ref<PanelState>;
  rows: ComputedRef<SignatureRow[]>;
  warning: ComputedRef<string>;
  isChecking: ComputedRef<boolean>;
  check: () => Promise<void>;
};

const describeOutcome = (
  outcome: VerificationOutcome,
): { label: string; detail: string; tone: Tone } => {
  switch (outcome.kind) {
    case "Valid":
      return {
        label: "Intact",
        detail:
          "Matches the certificate inside this message, so it was not altered. This does not say who signed it.",
        tone: "Good",
      };

    case "Invalid":
      return {
        label: "Invalid",
        detail:
          outcome.reason === "DigestMismatch"
            ? "The signed element has changed since it was signed."
            : "The signature does not match the certificate in this message.",
        tone: "Bad",
      };

    case "Unverifiable":
      return {
        label: "Unverifiable",
        detail: describeUnverifiable(outcome.reason),
        tone: "Unknown",
      };

    case "VerifierRefused":
      return {
        label: "Not checked",
        detail: outcome.message,
        tone: "Unknown",
      };

    case "Unsupported":
      return {
        label: "Unsupported",
        detail: `This plugin does not implement ${outcome.uri}.`,
        tone: "Unknown",
      };
  }
};

const describeUnverifiable = (reason: UnverifiableReason): string => {
  switch (reason) {
    case "MalformedSignature":
      return "The signature is missing parts this plugin needs to check it.";

    case "NoCertificate":
      return "The signature carries no certificate, so there is nothing to check it against.";

    case "ReferenceAmbiguous":
      return "More than one element carries the signed ID, so the signed element is ambiguous.";

    case "ReferenceMissing":
      return "No element carries the ID the signature says it covers.";
  }
};

const describeRisk = (risk: WrappingRisk): string => {
  switch (risk.kind) {
    case "None":
    case "NoSignature":
      return "";

    case "DuplicateId":
      return `${risk.count} elements share the signed ID ${risk.id}. A consumer may read a different one than the signature covers.`;

    case "UnresolvedReference":
      return isAbsent(risk.id)
        ? "The signature does not say which element it covers."
        : `The signature covers ID ${risk.id}, but no element carries it.`;

    case "SignedElementNotConsumed":
      return `The signature covers ID ${risk.signedId}, but the assertion a consumer reads is ${risk.consumedId}. This is the shape of a signature wrapping attack.`;

    case "SignedElementDetached":
      return `The element signed as ${risk.signedId} is not the assertion a consumer reads.`;
  }
};

export const useForm = (
  xml: () => string,
  service: CertificateService,
): SignaturePanelForm => {
  const state = ref<PanelState>({ kind: "Idle" });

  let generation = 0;

  const rows = computed(() =>
    state.value.kind === "Ready" ? state.value.rows : [],
  );

  return {
    state,
    rows,

    warning: computed(() =>
      state.value.kind === "Ready" ? describeRisk(state.value.risk) : "",
    ),

    isChecking: computed(() => state.value.kind === "Checking"),

    check: async () => {
      generation += 1;
      const run = generation;

      state.value = { kind: "Checking" };

      const parsed = parseXml(xml());
      if (parsed.kind !== "Ok") {
        state.value = { kind: "Unparseable" };
        return;
      }

      const elements = readSignatures(parsed.document);

      const checked: SignatureRow[] = [];
      for (const location of readSignatureLocations(parsed.document)) {
        const element = elements[location.index];
        if (isAbsent(element)) continue;

        const outcome = await verifySignature(element, service.verifySignature);
        if (run !== generation) return;

        checked.push({ ...location, ...describeOutcome(outcome) });
      }

      state.value = {
        kind: "Ready",
        rows: checked,
        risk: readWrappingRisk(parsed.document),
      };
    },
  };
};
