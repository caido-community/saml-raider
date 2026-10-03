import { computed, type MaybeRefOrGetter, toValue } from "vue";

import { type Compression, type SamlMessageInfo } from "@/core";
import { isAbsent, type Maybe } from "@/utils";

type InfoField = { label: string; value: string };

export type InfoGroup = { title: string; fields: InfoField[] };

export type InfoRow = { key: string; groups: InfoGroup[] };

const ABSENT = "—";

const formatValue = (value: Maybe<string>): string =>
  isAbsent(value) || value === "" ? ABSENT : value;

const formatFlag = (value: boolean): string => (value ? "Yes" : "No");

const formatSigned = (info: SamlMessageInfo): string =>
  info.signedElements.length === 0
    ? ABSENT
    : info.signedElements
        .map(
          (signed) =>
            `${signed.element}${isAbsent(signed.id) ? "" : ` (${signed.id})`}`,
        )
        .join(", ");

const toRow = (...groups: InfoGroup[]): InfoRow => ({
  key: groups.map((group) => group.title).join("+"),
  groups,
});

export const useForm = (
  info: MaybeRefOrGetter<SamlMessageInfo>,
  compression: MaybeRefOrGetter<Compression>,
) => {
  const rows = computed<InfoRow[]>(() => {
    const current = toValue(info);

    const assertion: InfoGroup = {
      title: "Assertion Information",
      fields: [
        {
          label: "Condition Not Before",
          value: formatValue(current.conditionNotBefore),
        },
        {
          label: "Condition Not After",
          value: formatValue(current.conditionNotAfter),
        },
        { label: "Issuer", value: formatValue(current.issuer) },
      ],
    };

    const signature: InfoGroup = {
      title: "Signature Information",
      fields: [
        {
          label: "Signature Algorithm",
          value: formatValue(current.signatureAlgorithm),
        },
        {
          label: "Digest Algorithm",
          value: formatValue(current.digestAlgorithm),
        },
      ],
    };

    const subject: InfoGroup = {
      title: "Subject Information",
      fields: [
        { label: "Subject", value: formatValue(current.subject) },
        {
          label: "Subject Conf. Not Before",
          value: formatValue(current.subjectConfirmationNotBefore),
        },
        {
          label: "Subject Conf. Not After",
          value: formatValue(current.subjectConfirmationNotAfter),
        },
      ],
    };

    const encryption: InfoGroup = {
      title: "Encryption Information",
      fields: [
        {
          label: "Encrypted with",
          value: formatValue(current.encryptionMethod),
        },
        {
          label: "Encrypted Assertions",
          value: String(current.encryptedAssertionCount),
        },
      ],
    };

    const message: InfoGroup = {
      title: "Message Information",
      fields: [
        { label: "Message Type", value: current.kind },
        { label: "Compression", value: toValue(compression) },
        { label: "Message ID", value: formatValue(current.id) },
        { label: "In Response To", value: formatValue(current.inResponseTo) },
        { label: "Destination", value: formatValue(current.destination) },
        { label: "Issue Instant", value: formatValue(current.issueInstant) },
        { label: "Status", value: formatValue(current.statusCode) },
        { label: "Assertions", value: String(current.assertionCount) },
        { label: "Signed Elements", value: formatSigned(current) },
        { label: "Duplicate IDs", value: formatFlag(current.hasDuplicateIds) },
      ],
    };

    return [
      toRow(assertion),
      toRow(signature),
      toRow(subject, encryption),
      toRow(message),
    ];
  });

  return { rows };
};
