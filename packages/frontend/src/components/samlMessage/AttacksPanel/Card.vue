<script setup lang="ts">
defineOptions({ name: "AttacksCard" });

const { title, hint = "" } = defineProps<{ title: string; hint?: string }>();
</script>

<template>
  <section class="min-w-0 border border-surface-700 rounded overflow-hidden">
    <header class="px-3 py-1.5 flex items-baseline gap-2 bg-surface-800/60">
      <span class="text-xs font-bold uppercase tracking-wide text-surface-300">
        {{ title }}
      </span>
      <span v-if="hint !== ''" class="text-xs text-surface-500">{{
        hint
      }}</span>
    </header>

    <div class="px-3 py-2 flex flex-wrap items-center gap-2">
      <slot />
      <div class="flex-1" />
      <div class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </section>
</template>
