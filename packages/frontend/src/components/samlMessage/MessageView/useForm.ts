import { type EditorView } from "@codemirror/view";
import {
  computed,
  type MaybeRefOrGetter,
  onMounted,
  ref,
  shallowRef,
  toValue,
} from "vue";

import {
  analyzeSamlMessage,
  buildMessageState,
  decodeMessage,
  isLikelySamlMessage,
} from "@/core";
import {
  type Compression,
  type DecodeFailure,
  type MessageState,
  type SamlMessageInfo,
} from "@/types";
import { isPresent, type Maybe } from "@/utils";

export type Panel = "Attacks" | "Info";

const PANELS: ReadonlyArray<{ label: string; value: Panel }> = [
  { label: "SAML Attacks", value: "Attacks" },
  { label: "SAML Message Info", value: "Info" },
];

export type MessageViewState =
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
    case "InvalidBase64":
      return "the parameter is not valid base64";

    case "DecompressionFailed":
      return "the parameter is neither XML nor a DEFLATE or gzip stream";

    case "NotSaml":
      return "no SAML message was found";

    case "MalformedXml":
      return failure.message;
  }
};

const buildViewState = (state: MessageState): MessageViewState => {
  switch (state.kind) {
    case "Idle":
      return {
        kind: "Notice",
        icon: "fas fa-spinner",
        message: "Reading request",
      };

    case "NotSaml":
      return {
        kind: "Notice",
        icon: "fas fa-shield-halved",
        message: "No SAML message in this request",
      };

    case "DecodeFailed":
      return {
        kind: "Notice",
        icon: "fas fa-triangle-exclamation",
        message: `Could not decode this SAML message: ${formatFailure(state.failure)}`,
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

export const useForm = (editor: MaybeRefOrGetter<Maybe<EditorView>>) => {
  const state = shallowRef<MessageState>({ kind: "Idle" });
  const panel = ref<Panel>("Attacks");

  let decoded: Maybe<string> = undefined;

  const load = async (raw: string) => {
    if (raw === decoded) return;
    decoded = raw;

    if (!isLikelySamlMessage(raw)) {
      state.value = { kind: "NotSaml" };
      return;
    }

    const analysis = analyzeSamlMessage(raw);
    const outcome = await decodeMessage(raw, analysis);
    if (raw !== decoded) return;

    state.value = buildMessageState(analysis, outcome);
  };

  const readRaw = (): string => toValue(editor)?.state.doc.toString() ?? "";

  onMounted(() => void load(readRaw()));

  const isWritable = computed(() => {
    const current = toValue(editor);
    return isPresent(current) && !current.state.readOnly;
  });

  return {
    state: computed(() => buildViewState(state.value)),
    panel,
    panels: PANELS,
    isWritable,
  };
};
