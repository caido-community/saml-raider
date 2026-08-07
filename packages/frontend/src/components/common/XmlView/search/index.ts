import { Classic } from "@caido/primevue";
import {
  getSearchQuery,
  search,
  type SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import { type EditorView, type ViewUpdate } from "@codemirror/view";
import PrimeVue from "primevue/config";
import { type App, createApp, ref, type Ref } from "vue";

import { SearchPanelKey } from "./constants";
import Panel from "./Panel.vue";

class SearchPanel {
  dom = document.createElement("div");

  private query: Ref<SearchQuery>;

  private revision: Ref<number>;

  private app: App<Element>;

  private view: EditorView;

  constructor(view: EditorView) {
    this.view = view;
    this.query = ref(getSearchQuery(view.state));
    this.revision = ref(0);

    this.app = createApp(Panel);
    this.app.use(PrimeVue, { unstyled: true, pt: Classic });
    this.app.provide(SearchPanelKey, {
      query: this.query,
      revision: this.revision,
      view,
    });
    this.app.mount(this.dom);
  }

  mount() {
    const input = this.dom.querySelector("input[data-main-field='true']");
    if (input instanceof HTMLInputElement && this.view.hasFocus) input.focus();
  }

  update(update: ViewUpdate) {
    if (update.docChanged) this.revision.value += 1;

    for (const transaction of update.transactions) {
      for (const effect of transaction.effects) {
        if (!effect.is(setSearchQuery)) continue;
        if (effect.value.eq(this.query.value)) continue;
        this.query.value = effect.value;
      }
    }
  }

  destroy() {
    this.app.unmount();
  }
}

export const buildSearchExtension = () =>
  search({ createPanel: (view) => new SearchPanel(view) });
