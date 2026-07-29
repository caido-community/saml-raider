<script setup lang="ts">
defineOptions({ name: "MessageViewEmpty" });

const { icon, message } = defineProps<{ icon: string; message: string }>();
</script>

<template>
  <div
    class="flex-1 min-h-0 min-w-0 flex flex-col items-center justify-center gap-3 text-surface-400"
  >
    <i :class="icon" class="text-3xl opacity-60" />
    <p class="text-sm max-w-xs text-center">{{ message }}</p>
  </div>
</template>
