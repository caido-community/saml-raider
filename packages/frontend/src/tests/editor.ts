import { type EditorView } from "@codemirror/view";

export type EditorDouble = {
  view: EditorView;
  text: () => string;
  dispatched: string[];
};

export const buildEditorDouble = (
  options: { text?: string; readOnly?: boolean; editable?: boolean } = {},
): EditorDouble => {
  let text = options.text ?? "";
  const dispatched: string[] = [];

  const view = {
    get state() {
      return {
        readOnly: options.readOnly ?? false,
        facet: () => options.editable ?? true,
        doc: { toString: () => text, length: text.length },
      };
    },
    dispatch: (transaction: { changes: { insert: string } }) => {
      dispatched.push(transaction.changes.insert);
      text = transaction.changes.insert;
    },
  };

  return {
    view: view as unknown as EditorView,
    text: () => text,
    dispatched,
  };
};
