import { type SignatureAlgorithm } from "shared";
import { computed, ref } from "vue";

import { type SelfSignedRequest } from "@/services/certificates";
import { isAbsent, isPresent, type Maybe } from "@/utils";

type CreateFields = {
  label: string;
  commonName: string;
  organization: string;
  organizationalUnit: string;
  country: string;
  state: string;
  locality: string;
  notBefore: Maybe<Date>;
  notAfter: Maybe<Date>;
  signatureAlgorithm: SignatureAlgorithm;
  isCertificateAuthority: boolean;
};

type FieldErrors = Partial<
  Record<
    | "label"
    | "commonName"
    | "organization"
    | "organizationalUnit"
    | "country"
    | "state"
    | "locality"
    | "notBefore"
    | "notAfter",
    string
  >
>;

const ALGORITHMS: ReadonlyArray<{
  label: string;
  value: SignatureAlgorithm;
}> = [
  { label: "SHA-256", value: "SHA-256" },
  { label: "SHA-384", value: "SHA-384" },
  { label: "SHA-512", value: "SHA-512" },
  { label: "SHA-1 (legacy)", value: "SHA-1" },
];

const buildDefaults = (): CreateFields => {
  const notBefore = new Date();
  notBefore.setHours(0, 0, 0, 0);

  const notAfter = new Date(notBefore);
  notAfter.setFullYear(notAfter.getFullYear() + 1);

  return {
    label: "",
    commonName: "",
    organization: "",
    organizationalUnit: "",
    country: "",
    state: "",
    locality: "",
    notBefore,
    notAfter,
    signatureAlgorithm: "SHA-256",
    isCertificateAuthority: false,
  };
};

const readSnapshot = (fields: CreateFields): string =>
  JSON.stringify({
    ...fields,
    notBefore: fields.notBefore?.getTime(),
    notAfter: fields.notAfter?.getTime(),
  });

const readOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const isValidDate = (value: Maybe<Date>): value is Date =>
  isPresent(value) && !Number.isNaN(value.getTime());

const readFieldErrors = (fields: CreateFields): FieldErrors => {
  const errors: FieldErrors = {};
  const label = fields.label.trim();
  const commonName = fields.commonName.trim();

  if (label === "") {
    errors.label = "A name is required.";
  }
  if (label.length > 200) {
    errors.label = "The name may be at most 200 characters.";
  }

  if (commonName === "") {
    errors.commonName = "A common name is required.";
  }
  if (commonName.length > 64) {
    errors.commonName = "The common name may be at most 64 characters.";
  }

  if (fields.organization.trim().length > 64) {
    errors.organization = "The organization may be at most 64 characters.";
  }
  if (fields.organizationalUnit.trim().length > 64) {
    errors.organizationalUnit =
      "The organizational unit may be at most 64 characters.";
  }
  if (fields.country.trim() !== "" && fields.country.trim().length !== 2) {
    errors.country = "Use a two-letter country code, such as CH.";
  }
  if (fields.state.trim().length > 128) {
    errors.state = "The state may be at most 128 characters.";
  }
  if (fields.locality.trim().length > 128) {
    errors.locality = "The locality may be at most 128 characters.";
  }

  if (!isValidDate(fields.notBefore)) {
    errors.notBefore = "Choose the first valid date.";
  }
  if (!isValidDate(fields.notAfter)) {
    errors.notAfter = "Choose the last valid date.";
  }
  if (
    isValidDate(fields.notBefore) &&
    isValidDate(fields.notAfter) &&
    fields.notAfter.getTime() <= fields.notBefore.getTime()
  ) {
    errors.notAfter = "The last valid date must be later than the first.";
  }

  return errors;
};

const toUtcStartOfDay = (value: Maybe<Date>): string => {
  if (isAbsent(value)) return "";
  return new Date(
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
  ).toISOString();
};

const toUtcEndOfDay = (value: Maybe<Date>): string => {
  if (isAbsent(value)) return "";
  return new Date(
    Date.UTC(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      23,
      59,
      59,
      999,
    ),
  ).toISOString();
};

export const useForm = () => {
  const defaults = buildDefaults();
  const fields = ref<CreateFields>(defaults);
  const pristineSnapshot = ref(readSnapshot(defaults));

  const fieldErrors = computed(() => readFieldErrors(fields.value));
  const isValid = computed(
    () => Object.values(fieldErrors.value).filter(isPresent).length === 0,
  );
  const isDirty = computed(
    () => readSnapshot(fields.value) !== pristineSnapshot.value,
  );

  const reset = () => {
    const nextDefaults = buildDefaults();
    fields.value = nextDefaults;
    pristineSnapshot.value = readSnapshot(nextDefaults);
  };

  return {
    fields,
    fieldErrors,
    isValid,
    isDirty,
    algorithms: ALGORITHMS,
    reset,
    buildRequest: (): SelfSignedRequest => ({
      label: fields.value.label.trim(),
      subject: {
        commonName: fields.value.commonName.trim(),
        organization: readOptional(fields.value.organization),
        organizationalUnit: readOptional(fields.value.organizationalUnit),
        country: readOptional(fields.value.country)?.toUpperCase(),
        state: readOptional(fields.value.state),
        locality: readOptional(fields.value.locality),
      },
      validity: {
        notBefore: toUtcStartOfDay(fields.value.notBefore),
        notAfter: toUtcEndOfDay(fields.value.notAfter),
      },
      signatureAlgorithm: fields.value.signatureAlgorithm,
      isCertificateAuthority: fields.value.isCertificateAuthority,
    }),
  };
};
