import { type SearchQuery } from "@codemirror/search";
import { type EditorView } from "@codemirror/view";
import { type InjectionKey, type Ref } from "vue";

export type SearchPanelContext = {
  view: EditorView;
  query: Ref<SearchQuery>;
  revision: Ref<number>;
};

export const SearchPanelKey: InjectionKey<SearchPanelContext> =
  Symbol("SamlSearchPanel");
