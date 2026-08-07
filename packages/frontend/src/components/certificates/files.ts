import { encodeBase64 } from "@/utils";

const PEM_MARKER = "-----BEGIN";

export const readPemOrDerFile = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  return text.includes(PEM_MARKER) ? text : encodeBase64(bytes);
};
