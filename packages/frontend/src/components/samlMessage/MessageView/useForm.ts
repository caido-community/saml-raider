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
  type SamlMessageInfo,
} from "@/core";

type Panel = "Attacks" | "Info";

type PanelOption = { label: string; value: Panel };

const PANELS: ReadonlyArray<PanelOption> = [
  { label: "SAML Attacks", value: "Attacks" },
  { label: "SAML Message Info", value: "Info" },
];

type MessageViewState =
  | { kind: "Notice"; icon: string; message: string }
  | {
      kind: "Message";
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
  isWritable: ComputedRef<boolean>;
};

export const useForm = (
  source: MaybeRefOrGetter<MessageSource>,
): MessageForm => {
  const panel = ref<Panel>("Attacks");

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

  return { state, panel, panels: PANELS, isWritable };
};
