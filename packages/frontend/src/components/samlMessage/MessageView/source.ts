import {
  type RequestDraft,
  type RequestFull,
  type ResponseFull,
} from "@caido/sdk-frontend";
import { EditorView } from "@codemirror/view";

import { isPresent, type Maybe } from "@/utils";

export type ViewModeProps = {
  request?: Maybe<RequestFull>;
  draft?: Maybe<RequestDraft>;
  response?: Maybe<ResponseFull>;
  view?: Maybe<EditorView>;
};

export type MessageSource =
  | { kind: "WritableRequest"; raw: string; view: EditorView }
  | { kind: "ReadableRequest"; raw: string }
  | { kind: "Response"; raw: string }
  | { kind: "Absent" };

const isEditorWritable = (view: EditorView): boolean =>
  view.state.readOnly !== true &&
  view.state.facet(EditorView.editable) !== false;

export const readMessageSource = (props: ViewModeProps): MessageSource => {
  if (isPresent(props.draft)) {
    const view = props.view;
    return isPresent(view) && isEditorWritable(view)
      ? { kind: "WritableRequest", raw: props.draft.raw, view }
      : { kind: "ReadableRequest", raw: props.draft.raw };
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

export type WriteBackOutcome =
  | { kind: "Written" }
  | { kind: "Refused"; reason: "ReadOnly" | "Diverged" | "Unchanged" };

export const applyRawToEditor = (
  view: EditorView,
  baseline: string,
  next: string,
): WriteBackOutcome => {
  if (!isEditorWritable(view)) return { kind: "Refused", reason: "ReadOnly" };

  const current = view.state.doc.toString();
  if (current !== baseline) return { kind: "Refused", reason: "Diverged" };
  if (current === next) return { kind: "Refused", reason: "Unchanged" };

  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: next },
  });

  return { kind: "Written" };
};
