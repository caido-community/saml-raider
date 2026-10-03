<script setup lang="ts">
import Button from "primevue/button";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";
import InputText from "primevue/inputtext";
import { inject } from "vue";

import { type SearchPanelContext, SearchPanelKey } from "./constants";
import { useForm } from "./useForm";

defineOptions({ name: "XmlViewSearchPanel" });

const context = inject(SearchPanelKey) as SearchPanelContext;

const form = useForm(context.view, context.query, context.revision);
</script>

<template>
  <div class="p-1 bg-surface-900 flex gap-1 items-center">
    <div class="flex-1 min-w-0">
      <InputGroup>
        <InputText
          v-model="form.search.value"
          data-main-field="true"
          placeholder="Search"
          aria-label="Search"
          size="small"
          fluid
          @keydown="form.onKeyDown"
        />
        <InputGroupAddon class="!p-0 w-24 border-l-0 !text-surface-300">
          <span class="text-xs">
            {{
              form.count.value === 0
                ? "No matches"
                : form.count.value === 1
                  ? "1 match"
                  : `${form.count.value} matches`
            }}
          </span>
        </InputGroupAddon>
      </InputGroup>
    </div>

    <Button
      severity="contrast"
      outlined
      size="small"
      icon="fas fa-arrow-left"
      title="Previous (Shift+Enter)"
      @click="form.previous"
    />
    <Button
      severity="contrast"
      outlined
      size="small"
      icon="fas fa-arrow-right"
      title="Next (Enter)"
      @click="form.next"
    />
    <Button
      :severity="form.asRegex.value ? 'info' : 'contrast'"
      :outlined="!form.asRegex.value"
      size="small"
      label="as regex"
      @click="form.toggleRegex"
    />
    <Button
      :severity="form.matchCase.value ? 'info' : 'contrast'"
      :outlined="!form.matchCase.value"
      size="small"
      label="match case"
      @click="form.toggleMatchCase"
    />
    <Button
      :severity="form.byWord.value ? 'info' : 'contrast'"
      :outlined="!form.byWord.value"
      size="small"
      label="by word"
      @click="form.toggleByWord"
    />
    <Button
      severity="contrast"
      outlined
      size="small"
      icon="fas fa-xmark"
      title="Close"
      @click="form.close"
    />
  </div>
</template>
