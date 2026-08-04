import {
  type RequestDraft,
  type RequestFull,
  type ResponseFull,
} from "@caido/sdk-frontend";
import { type EditorView } from "@codemirror/view";

import { type FrontendSDK } from "@/types";
import { isPresent, type Maybe } from "@/utils";

export type ViewModeProps = {
  request?: Maybe<RequestFull>;
  draft?: Maybe<RequestDraft>;
  response?: Maybe<ResponseFull>;
  view?: Maybe<EditorView>;
  sdk?: Maybe<FrontendSDK>;
};

export type MessageSource =
  | { kind: "WritableRequest"; raw: string }
  | { kind: "ReadableRequest"; raw: string }
  | { kind: "Response"; raw: string }
  | { kind: "Absent" };

export const readMessageSource = (props: ViewModeProps): MessageSource => {
  const isEditorReadOnly = props.view?.state.readOnly === true;

  if (isPresent(props.draft)) {
    return isEditorReadOnly
      ? { kind: "ReadableRequest", raw: props.draft.raw }
      : { kind: "WritableRequest", raw: props.draft.raw };
  }

  if (isPresent(props.request)) {
    return { kind: "ReadableRequest", raw: props.request.raw };
  }

  if (isPresent(props.response)) {
    return { kind: "Response", raw: props.response.raw };
  }

  return { kind: "Absent" };
};

export const readSourceRaw = (source: MessageSource): string =>
  source.kind === "Absent" ? "" : source.raw;

export const isWritableSource = (source: MessageSource): boolean =>
  source.kind === "WritableRequest";

export const describeSource = (source: MessageSource): string =>
  source.kind === "Response" ? "response" : "request";
