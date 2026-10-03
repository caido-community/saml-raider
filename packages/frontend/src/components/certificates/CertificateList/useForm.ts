import { type Certificate } from "shared";
import { computed, type MaybeRefOrGetter, ref, toValue } from "vue";

import { isAbsent, isPresent, type Maybe } from "@/utils";

export type CertificateRow = {
  certificate: Certificate;
  depth: number;
};

const matches = (certificate: Certificate, needle: string): boolean => {
  const details = certificate.details;
  return [
    certificate.label,
    details.subject,
    details.issuer,
    details.fingerprintSha256,
    details.serialNumberHex,
    ...details.subjectAlternativeNames,
  ].some((field) => field.toLowerCase().includes(needle));
};

const readVisible = (
  certificates: Certificate[],
  filter: string,
): Certificate[] => {
  const needle = filter.trim().toLowerCase();
  if (needle === "") return certificates;

  const certificatesById = new Map(
    certificates.map((certificate) => [certificate.id, certificate]),
  );
  const visibleIds = new Set<string>();

  for (const certificate of certificates) {
    if (!matches(certificate, needle)) continue;

    const visitedIds = new Set<string>();
    let certificateId: Maybe<string> = certificate.id;
    while (isPresent(certificateId) && !visitedIds.has(certificateId)) {
      visitedIds.add(certificateId);
      visibleIds.add(certificateId);
      certificateId = certificatesById.get(certificateId)?.parentId;
    }
  }

  return certificates.filter((certificate) => visibleIds.has(certificate.id));
};

const buildRows = (certificates: Certificate[]): CertificateRow[] => {
  const certificateIds = new Set(
    certificates.map((certificate) => certificate.id),
  );
  const certificatesByParent = new Map<string, Certificate[]>();

  for (const certificate of certificates) {
    const parentId =
      isPresent(certificate.parentId) &&
      certificateIds.has(certificate.parentId)
        ? certificate.parentId
        : "";
    certificatesByParent.set(parentId, [
      ...(certificatesByParent.get(parentId) ?? []),
      certificate,
    ]);
  }

  const compareLabels = (left: Certificate, right: Certificate) =>
    left.label.localeCompare(right.label);
  const rows: CertificateRow[] = [];
  const emittedIds = new Set<string>();

  const appendChildren = (parentId: string, depth: number) => {
    const children = [...(certificatesByParent.get(parentId) ?? [])].sort(
      compareLabels,
    );
    for (const certificate of children) {
      if (emittedIds.has(certificate.id)) continue;

      emittedIds.add(certificate.id);
      rows.push({ certificate, depth });
      appendChildren(certificate.id, depth + 1);
    }
  };

  appendChildren("", 0);

  for (const certificate of [...certificates].sort(compareLabels)) {
    if (emittedIds.has(certificate.id)) continue;
    emittedIds.add(certificate.id);
    rows.push({ certificate, depth: 0 });
  }

  return rows;
};

export const useForm = (options: {
  certificates: MaybeRefOrGetter<Certificate[]>;
  filter: MaybeRefOrGetter<string>;
  select: (id: string) => void;
  clearFilter: () => void;
}) => {
  const rows = computed(() =>
    buildRows(
      readVisible(toValue(options.certificates), toValue(options.filter)),
    ),
  );
  const buttons = ref<HTMLElement[]>([]);

  const selectAt = (index: number) => {
    const row = rows.value[index];
    if (isAbsent(row)) return;

    options.select(row.certificate.id);
    buttons.value[index]?.focus();
  };

  return {
    rows,
    hasFilter: computed(() => toValue(options.filter).trim() !== ""),
    isExpired: (notAfter: string) => Date.parse(notAfter) < Date.now(),
    readIndent: (depth: number, offset = 0) => ({
      paddingLeft: String(depth * 14 + offset) + "px",
    }),
    setButton: (index: number, element: unknown) => {
      if (element instanceof HTMLElement) buttons.value[index] = element;
    },
    select: options.select,
    clearFilter: options.clearFilter,
    move: (from: number, delta: number) => {
      const target = Math.min(Math.max(from + delta, 0), rows.value.length - 1);
      selectAt(target);
    },
  };
};
