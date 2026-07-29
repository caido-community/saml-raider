import { type Compression, type DecodeOutcome } from "@/types";
import {
  decodeBase64,
  encodeBase64,
  isAbsent,
  isPresent,
  type Maybe,
} from "@/utils";

type Compressed = Exclude<Compression, "None">;

const COMPRESSION_FORMATS: Record<Compressed, CompressionFormat> = {
  Gzip: "gzip",
  Deflate: "deflate-raw",
};

const DETECTION_ORDER: ReadonlyArray<Compressed> = ["Gzip", "Deflate"];

const decompress = async (
  bytes: Uint8Array,
  format: CompressionFormat,
): Promise<Maybe<Uint8Array>> => {
  try {
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return undefined;
  }
};

const compress = async (
  bytes: Uint8Array,
  format: CompressionFormat,
): Promise<Uint8Array> => {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const readText = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

export const decodeSamlParameter = async (
  value: string,
): Promise<DecodeOutcome> => {
  const bytes = decodeBase64(decodeURIComponent(value).replace(/\s+/g, ""));
  if (isAbsent(bytes)) {
    return { kind: "Failed", failure: { kind: "InvalidBase64" } };
  }

  for (const compression of DETECTION_ORDER) {
    const decompressed = await decompress(
      bytes,
      COMPRESSION_FORMATS[compression],
    );
    if (isPresent(decompressed)) {
      return {
        kind: "Ok",
        value: { xml: readText(decompressed), compression },
      };
    }
  }

  const xml = readText(bytes);
  if (!xml.trimStart().startsWith("<")) {
    return { kind: "Failed", failure: { kind: "DecompressionFailed" } };
  }

  return { kind: "Ok", value: { xml, compression: "None" } };
};

export const encodeSamlParameter = async (
  xml: string,
  compression: Compression,
): Promise<string> => {
  const bytes = new TextEncoder().encode(xml);
  if (compression === "None") return encodeURIComponent(encodeBase64(bytes));

  const compressed = await compress(bytes, COMPRESSION_FORMATS[compression]);
  return encodeURIComponent(encodeBase64(compressed));
};
