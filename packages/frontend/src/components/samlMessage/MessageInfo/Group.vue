<script setup lang="ts">
import { type InfoGroup } from "./useForm";

defineOptions({ name: "MessageInfoGroup" });

const { group } = defineProps<{ group: InfoGroup }>();
</script>

<template>
  <section class="h-full border border-surface-700 rounded overflow-hidden">
    <header
      class="px-2 py-1 text-xs font-bold uppercase tracking-wide text-surface-300 bg-surface-800/60"
    >
      {{ group.title }}
    </header>
    <dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 px-2 py-1.5">
      <template v-for="field in group.fields" :key="field.label">
        <dt class="text-xs text-surface-400 whitespace-nowrap">
          {{ field.label }}
        </dt>
        <dd class="text-xs text-surface-200 break-all">
          {{ field.value }}
        </dd>
      </template>
    </dl>
  </section>
</template>
