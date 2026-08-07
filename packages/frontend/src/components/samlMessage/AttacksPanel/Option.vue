<script setup lang="ts">
defineOptions({ name: "AttacksOption" });

const { label, note, reason } = defineProps<{
  label: string;
  note: string;
  reason: string;
}>();
</script>

<template>
  <div class="flex flex-col" :class="{ 'opacity-40': reason !== '' }">
    <span>{{ label }}</span>
    <span v-if="reason !== ''" class="text-xs text-surface-400">
      {{ reason }}
    </span>
    <span v-else-if="note !== ''" class="text-xs text-surface-500">
      {{ note }}
    </span>
  </div>
</template>
