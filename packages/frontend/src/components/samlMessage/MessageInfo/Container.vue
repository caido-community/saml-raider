<script setup lang="ts">
import Group from "./Group.vue";
import { useForm } from "./useForm";

import { XmlView } from "@/components/common/XmlView";
import { type Compression, type SamlMessageInfo } from "@/types";

defineOptions({ name: "MessageInfo" });

const { info, prettyXml, compression } = defineProps<{
  info: SamlMessageInfo;
  prettyXml: string;
  compression: Compression;
}>();

const { stackedGroups, pairedGroups } = useForm(
  () => info,
  () => compression,
);
</script>

<template>
  <div class="h-full w-full min-w-0 flex flex-col gap-2 p-2">
    <div class="shrink-0 flex flex-col gap-2 min-w-0">
      <Group v-for="group in stackedGroups" :key="group.title" :group="group" />

      <div class="grid grid-cols-2 gap-2 min-w-0">
        <Group
          v-for="group in pairedGroups"
          :key="group.title"
          :group="group"
        />
      </div>
    </div>

    <section
      class="flex-1 min-h-0 min-w-0 flex flex-col border border-surface-700 rounded overflow-hidden"
    >
      <header
        class="shrink-0 px-2 py-1 text-xs font-bold uppercase tracking-wide text-surface-300 bg-surface-800/60"
      >
        Parsed &amp; Prettified
      </header>
      <div class="flex-1 min-h-0 min-w-0">
        <XmlView :content="prettyXml" />
      </div>
    </section>
  </div>
</template>
