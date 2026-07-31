import { deflateSync, gunzipSync, gzipSync, inflateSync } from "fflate";

import { type Compression, type DecodeOutcome } from "./types";

import {
  decodeBase64,
  decodeUri,
  encodeBase64,
  isAbsent,
  isPresent,
  type Maybe,
} from "@/utils";

type Compressed = Exclude<Compression, "None">;

export const MAX_ENCODED_BYTES = 8 * 1024 * 1024;

export const MAX_DECODED_BYTES = 32 * 1024 * 1024;

// DEFLATE cannot expand by more than 1032:1, so bounding the compressed input
// bounds the allocation before it happens. fflate hands back the whole buffer
// in one callback, and its bounded output buffer truncates silently, so neither
// streaming nor an output cap can be used as the guard.
const MAX_EXPANSION_RATIO = 1032;

const MAX_COMPRESSED_BYTES = Math.floor(
  MAX_DECODED_BYTES / MAX_EXPANSION_RATIO,
);

const DECOMPRESSORS: ReadonlyArray<{
  compression: Compressed;
  run: (bytes: Uint8Array) => Uint8Array;
}> = [
  { compression: "Gzip", run: gunzipSync },
  { compression: "Deflate", run: inflateSync },
];

const decompress = (
  bytes: Uint8Array,
  run: (input: Uint8Array) => Uint8Array,
): Maybe<Uint8Array> => {
  try {
    const output = run(bytes);
    return output.length > MAX_DECODED_BYTES ? undefined : output;
  } catch {
    return undefined;
  }
};

const compress = (bytes: Uint8Array, compression: Compressed): Uint8Array =>
  compression === "Gzip" ? gzipSync(bytes) : deflateSync(bytes);

const readText = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

export const decodeSamlParameter = (value: string): DecodeOutcome => {
  if (value.length > MAX_ENCODED_BYTES) {
    return { kind: "Failed", failure: { kind: "TooLarge" } };
  }

  const unescaped = decodeUri(value);
  if (isAbsent(unescaped)) {
    return { kind: "Failed", failure: { kind: "MalformedUrlEncoding" } };
  }

  const bytes = decodeBase64(unescaped.replace(/\s+/g, ""));
  if (isAbsent(bytes)) {
    return { kind: "Failed", failure: { kind: "InvalidBase64" } };
  }

  if (bytes.length <= MAX_COMPRESSED_BYTES) {
    for (const { compression, run } of DECOMPRESSORS) {
      const decompressed = decompress(bytes, run);
      if (isPresent(decompressed)) {
        return {
          kind: "Ok",
          value: { xml: readText(decompressed), compression },
        };
      }
    }
  }

  const xml = readText(bytes);
  if (!xml.trimStart().startsWith("<")) {
    return { kind: "Failed", failure: { kind: "DecompressionFailed" } };
  }

  return { kind: "Ok", value: { xml, compression: "None" } };
};

export const encodeSamlParameter = (
  xml: string,
  compression: Compression,
): string => {
  const bytes = new TextEncoder().encode(xml);
  if (compression === "None") return encodeURIComponent(encodeBase64(bytes));

  return encodeURIComponent(encodeBase64(compress(bytes, compression)));
};
