import {
  closeSearchPanel,
  findNext,
  findPrevious,
  SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import { type EditorView } from "@codemirror/view";
import {
  computed,
  type ComputedRef,
  type Ref,
  type WritableComputedRef,
} from "vue";

export type SearchForm = {
  search: WritableComputedRef<string>;
  asRegex: ComputedRef<boolean>;
  matchCase: ComputedRef<boolean>;
  byWord: ComputedRef<boolean>;
  count: ComputedRef<number>;
  toggleRegex: () => void;
  toggleMatchCase: () => void;
  toggleByWord: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  next: () => void;
  previous: () => void;
  close: () => void;
};

export const useForm = (
  view: EditorView,
  query: Ref<SearchQuery>,
  revision: Ref<number>,
): SearchForm => {
  const revise = (changes: {
    search?: string;
    regexp?: boolean;
    caseSensitive?: boolean;
    wholeWord?: boolean;
  }) => {
    const next = new SearchQuery({
      search: changes.search ?? query.value.search,
      regexp: changes.regexp ?? query.value.regexp,
      caseSensitive: changes.caseSensitive ?? query.value.caseSensitive,
      wholeWord: changes.wholeWord ?? query.value.wholeWord,
    });

    if (query.value.eq(next)) return;
    view.dispatch({ effects: setSearchQuery.of(next) });
  };

  return {
    search: computed({
      get: () => query.value.search,
      set: (value: string) => revise({ search: value }),
    }),

    asRegex: computed(() => query.value.regexp),
    matchCase: computed(() => query.value.caseSensitive),
    byWord: computed(() => query.value.wholeWord),

    count: computed(() => {
      void revision.value;
      if (query.value.search === "" || !query.value.valid) return 0;

      const cursor = query.value.getCursor(view.state);
      let matches = 0;
      for (;;) {
        if (cursor.next().done === true) return matches;
        matches += 1;
      }
    }),

    toggleRegex: () => revise({ regexp: !query.value.regexp }),
    toggleMatchCase: () =>
      revise({ caseSensitive: !query.value.caseSensitive }),
    toggleByWord: () => revise({ wholeWord: !query.value.wholeWord }),

    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (event.shiftKey) findPrevious(view);
      else findNext(view);
    },

    next: () => findNext(view),
    previous: () => findPrevious(view),
    close: () => closeSearchPanel(view),
  };
};
