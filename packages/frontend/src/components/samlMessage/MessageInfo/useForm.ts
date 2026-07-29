import { computed, type MaybeRefOrGetter, toValue } from "vue";

import { type Compression, type SamlMessageInfo } from "@/types";
import { isAbsent, type Maybe } from "@/utils";

type InfoField = { label: string; value: string };

export type InfoGroup = { title: string; fields: InfoField[] };

const ABSENT = "—";

const formatValue = (value: Maybe<string>): string =>
  isAbsent(value) || value === "" ? ABSENT : value;

export const useForm = (
  info: MaybeRefOrGetter<SamlMessageInfo>,
  compression: MaybeRefOrGetter<Compression>,
) => {
  const stackedGroups = computed<InfoGroup[]>(() => {
    const current = toValue(info);

    return [
      {
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
      },
      {
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
      },
      {
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
      },
    ];
  });

  const pairedGroups = computed<InfoGroup[]>(() => [
    {
      title: "Encryption Information",
      fields: [
        {
          label: "Encrypted with",
          value: formatValue(toValue(info).encryptionMethod),
        },
      ],
    },
    {
      title: "Message Information",
      fields: [{ label: "Compression", value: toValue(compression) }],
    },
  ]);

  return { stackedGroups, pairedGroups };
};
