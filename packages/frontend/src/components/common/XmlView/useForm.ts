import { xml } from "@codemirror/lang-xml";
import { foldGutter } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import {
  type MaybeRefOrGetter,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  toValue,
} from "vue";

import { buildSearchExtension } from "./search";
import { buildTheme } from "./theme";

import { isAbsent, type Maybe } from "@/utils";

const buildExtensions = (): Extension[] => [
  EditorState.readOnly.of(true),
  xml(),
  lineNumbers(),
  foldGutter(),
  EditorView.lineWrapping,
  keymap.of(searchKeymap),
  buildSearchExtension(),
  highlightSelectionMatches(),
  ...buildTheme(),
];

export const useForm = (
  container: MaybeRefOrGetter<Maybe<HTMLElement>>,
  content: MaybeRefOrGetter<string>,
) => {
  let view: Maybe<EditorView> = undefined;

  const destroy = () => {
    view?.destroy();
    view = undefined;
  };

  const create = () => {
    const target = toValue(container);
    if (isAbsent(target)) return;

    destroy();
    view = new EditorView({
      state: EditorState.create({
        doc: toValue(content),
        extensions: buildExtensions(),
      }),
      parent: target,
    });
  };

  const sync = () => {
    if (isAbsent(view)) return;

    const next = toValue(content);
    if (view.state.doc.toString() === next) return;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
    });
  };

  onMounted(create);
  onUpdated(sync);
  onBeforeUnmount(destroy);
};
