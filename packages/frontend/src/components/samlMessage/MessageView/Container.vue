<script setup lang="ts">
import { type EditorView } from "@codemirror/view";
import SelectButton from "primevue/selectbutton";

import Empty from "./Empty.vue";
import { useForm } from "./useForm";

import { XmlView } from "@/components/common/XmlView";
import { MessageInfo } from "@/components/samlMessage/MessageInfo";

defineOptions({ name: "MessageView", inheritAttrs: false });

const { view = undefined } = defineProps<{ view?: EditorView }>();

const { state, panel, panels, isWritable } = useForm(() => view);
</script>

<template>
  <Empty
    v-if="state.kind === 'Notice'"
    :icon="state.icon"
    :message="state.message"
  />

  <div v-else class="h-full flex flex-col min-h-0">
    <div class="flex items-center gap-2 px-2 py-1 border-b border-surface-700">
      <SelectButton
        v-model="panel"
        :options="panels"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        size="small"
      />
      <div class="flex-1" />
      <span v-if="!isWritable" class="text-xs text-surface-400 pr-1">
        <i class="fas fa-lock mr-1" />read only
      </span>
    </div>

    <div class="flex-1 min-h-0 min-w-0 overflow-y-auto">
      <XmlView v-if="panel === 'Attacks'" :content="state.xml" wrap />
      <MessageInfo
        v-else
        :info="state.info"
        :pretty-xml="state.prettyXml"
        :compression="state.compression"
      />
    </div>
  </div>
</template>
