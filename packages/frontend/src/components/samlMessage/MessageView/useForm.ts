import {
  computed,
  type ComputedRef,
  type MaybeRefOrGetter,
  ref,
  type Ref,
  toValue,
} from "vue";

import {
  describeSource,
  isWritableSource,
  type MessageSource,
  readSourceRaw,
} from "./source";

import { analyzeSamlMessage, buildMessageState, decodeMessage } from "@/core";
import {
  type Compression,
  type DecodeFailure,
  type MessageState,
  type SamlAnalysis,
  type SamlMessageInfo,
} from "@/core";

type Panel = "Message" | "Info" | "Attacks";

type PanelOption = { label: string; value: Panel };

const PANELS: ReadonlyArray<PanelOption> = [
  { label: "SAML Message", value: "Message" },
  { label: "SAML Message Info", value: "Info" },
  { label: "SAML Attacks", value: "Attacks" },
];

type Format = "Pretty" | "Raw";

type FormatOption = { label: string; value: Format };

const FORMATS: ReadonlyArray<FormatOption> = [
  { label: "Raw", value: "Raw" },
  { label: "Pretty", value: "Pretty" },
];

type MessageViewState =
  | { kind: "Notice"; icon: string; message: string }
  | {
      kind: "Message";
      analysis: SamlAnalysis;
      compression: Compression;
      xml: string;
      prettyXml: string;
      info: SamlMessageInfo;
    };

const formatFailure = (failure: DecodeFailure): string => {
  switch (failure.kind) {
    case "MalformedUrlEncoding":
      return "the parameter is not valid percent-encoding";

    case "InvalidBase64":
      return "the parameter is not valid base64";

    case "DecompressionFailed":
      return "the parameter is neither XML nor a DEFLATE or gzip stream";

    case "TooLarge":
      return "the message exceeds the size this plugin will decode";

    case "NotSaml":
      return "no SAML message was found";

    case "MalformedXml":
      return failure.message;

    case "DoctypeRejected":
      return `it declares a document type (<!DOCTYPE ${failure.name}>), which is refused because SAML messages do not need one and it is a common XXE vector`;
  }
};

const buildViewState = (
  state: MessageState,
  surface: string,
): MessageViewState => {
  switch (state.kind) {
    case "NotSaml":
      return {
        kind: "Notice",
        icon: "fas fa-shield-halved",
        message: `No SAML message in this ${surface}`,
      };

    case "DecodeFailed":
      return {
        kind: "Notice",
        icon: "fas fa-triangle-exclamation",
        message: `Could not decode the SAML message in this ${surface}: ${formatFailure(state.failure)}`,
      };

    case "Decoded":
      return {
        kind: "Message",
        analysis: state.analysis,
        compression: state.compression,
        xml: state.xml,
        prettyXml: state.prettyXml,
        info: state.info,
      };
  }
};

export type MessageForm = {
  state: ComputedRef<MessageViewState>;
  panel: Ref<Panel>;
  panels: ReadonlyArray<PanelOption>;
  format: Ref<Format>;
  formats: ReadonlyArray<FormatOption>;
  messageText: ComputedRef<string>;
  isWritable: ComputedRef<boolean>;
};

export const useForm = (
  source: MaybeRefOrGetter<MessageSource>,
): MessageForm => {
  const panel = ref<Panel>("Message");
  const format = ref<Format>("Raw");

  const state = computed(() => {
    const current = toValue(source);
    const raw = readSourceRaw(current);
    const analysis = analyzeSamlMessage(raw);
    const outcome = decodeMessage(raw, analysis);

    return buildViewState(
      buildMessageState(analysis, outcome),
      describeSource(current),
    );
  });

  const isWritable = computed(() => isWritableSource(toValue(source)));

  const messageText = computed(() => {
    const current = state.value;
    if (current.kind !== "Message") return "";
    return format.value === "Pretty" ? current.prettyXml : current.xml;
  });

  return {
    state,
    panel,
    panels: PANELS,
    format,
    formats: FORMATS,
    messageText,
    isWritable,
  };
};
