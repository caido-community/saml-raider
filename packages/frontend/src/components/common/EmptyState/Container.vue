<script setup lang="ts">
defineOptions({ name: "EmptyState" });

const {
  icon,
  title,
  message = undefined,
} = defineProps<{
  icon: string;
  title: string;
  message?: string;
}>();
</script>

<template>
  <div
    class="h-full min-h-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
  >
    <i :class="icon" class="text-3xl text-surface-500" />
    <p class="text-base font-semibold text-surface-100">{{ title }}</p>
    <p v-if="message !== undefined" class="text-sm text-surface-400 max-w-md">
      {{ message }}
    </p>
    <slot />
  </div>
</template>
