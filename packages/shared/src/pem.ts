const LINE_LENGTH = 64;

export const buildPem = (label: string, body: string): string => {
  const wrapped = body
    .replace(new RegExp(`(.{${LINE_LENGTH}})`, "g"), "$1\n")
    .trimEnd();
  return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----\n`;
};
