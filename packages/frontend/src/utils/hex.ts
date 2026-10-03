export const formatHex = (value: string): string =>
  (value.match(/.{1,2}/g) ?? []).join(":");
