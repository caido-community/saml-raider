<script setup lang="ts">
import Card from "primevue/card";

defineOptions({ name: "PageHeader" });

const { title, description } = defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <Card
    class="shrink-0"
    :pt="{
      body: { class: 'p-0' },
      content: { class: 'p-0' },
    }"
  >
    <template #content>
      <div class="p-4 min-w-0">
        <h2 class="text-lg font-semibold leading-tight">{{ title }}</h2>
        <p class="text-sm text-surface-400">{{ description }}</p>
      </div>
    </template>
  </Card>
</template>
