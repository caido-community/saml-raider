import { type ParameterNames } from "shared";

const MAXIMUM_SCANNED = 512 * 1024;

export const looksLikeSaml = (raw: string, names: ParameterNames): boolean => {
  const scanned =
    raw.length > MAXIMUM_SCANNED ? raw.slice(0, MAXIMUM_SCANNED) : raw;

  return (
    scanned.includes(`${names.samlRequest}=`) ||
    scanned.includes(`${names.samlResponse}=`)
  );
};
