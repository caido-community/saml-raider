import {
  type RequestDraft,
  type RequestFull,
  type ResponseFull,
} from "@caido/sdk-frontend";
import { type EditorView } from "@codemirror/view";

import { isPresent, type Maybe } from "@/utils";

/**
 * The host renders this component on three surfaces and supplies a different
 * prop set for each: writable requests get a draft, readable requests get a
 * persisted request, responses get a response. Vue props arrive as one flat
 * object, so the union lives in the resolved source rather than in the props.
 */
export type ViewModeProps = {
  request?: Maybe<RequestFull>;
  draft?: Maybe<RequestDraft>;
  response?: Maybe<ResponseFull>;
  view?: Maybe<EditorView>;
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
