<script setup lang="ts">
import { useTemplateRef } from "vue";

import { useForm } from "./useForm";

defineOptions({ name: "XmlView" });

const { content } = defineProps<{ content: string }>();

const container = useTemplateRef<HTMLElement>("container");

useForm(
  () => container.value ?? undefined,
  () => content,
);
</script>

<template>
  <div ref="container" class="w-full min-w-0 text-xs" />
</template>
