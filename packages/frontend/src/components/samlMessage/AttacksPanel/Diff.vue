<script setup lang="ts">
import Button from "primevue/button";

import { type LineDiff } from "@/utils";

defineOptions({ name: "AttackDiff" });

const { label, description, effect, diff } = defineProps<{
  label: string;
  description: string;
  effect: string;
  diff: LineDiff;
}>();

defineEmits<{ apply: []; discard: [] }>();
</script>

<template>
  <section
    class="w-full min-w-0 border border-surface-700 rounded overflow-hidden"
  >
    <header
      class="px-2 py-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-surface-300 bg-surface-800/60"
    >
      <span class="flex-1 truncate">{{ label }}</span>
      <span class="font-normal normal-case text-surface-400">
        +{{ diff.added }} / -{{ diff.removed }}
      </span>
      <Button
        label="Discard"
        size="small"
        severity="contrast"
        text
        @click="$emit('discard')"
      />
      <Button label="Apply to request" size="small" @click="$emit('apply')" />
    </header>

    <p class="px-2 py-1.5 text-xs text-surface-300">{{ description }}</p>
    <p
      class="mx-2 mb-1.5 flex items-start gap-2 rounded bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200"
    >
      <i class="fas fa-triangle-exclamation mt-0.5 shrink-0" />
      <span>{{ effect }}</span>
    </p>

    <p v-if="diff.isApproximate" class="px-2 pb-1 text-xs text-surface-400">
      This change is too large to align line by line, so the diff shows the
      whole changed region.
    </p>

    <div class="max-h-80 overflow-auto">
      <div
        v-for="(line, index) in diff.lines"
        :key="index"
        class="px-2 font-mono text-xs whitespace-pre-wrap break-all"
        :class="{
          'bg-green-500/10 text-green-300': line.kind === 'Added',
          'bg-red-500/10 text-red-300': line.kind === 'Removed',
          'text-surface-400': line.kind === 'Same',
        }"
      >
        {{ line.kind === "Added" ? "+" : line.kind === "Removed" ? "-" : " " }}
        {{ line.text }}
      </div>
    </div>
  </section>
</template>
