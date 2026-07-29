<script setup lang="ts">
defineOptions({ name: "XmlView" });

const { content, wrap = false } = defineProps<{
  content: string;
  wrap?: boolean;
}>();
</script>

<template>
  <div class="h-full w-full min-w-0 overflow-auto">
    <pre
      :class="[
        'p-2 text-xs leading-relaxed text-surface-200',
        wrap ? 'whitespace-pre-wrap break-all' : 'w-max whitespace-pre',
      ]"
      >{{ content }}</pre>
  </div>
</template>
