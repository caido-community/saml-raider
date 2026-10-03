<script setup lang="ts">
import Select from "primevue/select";
import ToggleSwitch from "primevue/toggleswitch";
import { onMounted } from "vue";

import { useForm } from "./useForm";

import { type PreferenceService } from "@/services/preferences";
import { type NotificationSink } from "@/types";

defineOptions({ name: "HighlightSettings" });

const { service, notifications } = defineProps<{
  service: PreferenceService;
  notifications: NotificationSink;
}>();

const form = useForm({ service, notifications });

onMounted(() => void form.load());
</script>

<template>
  <div class="p-4 flex items-start justify-between gap-4">
    <div>
      <h3 class="text-base font-semibold">Highlight SAML traffic</h3>
      <p class="text-sm text-surface-400">
        Colours a request in the proxy history when it carries a SAML parameter.
        Detection is a name match only, so it says nothing about whether the
        message parses or its signature holds.
      </p>
    </div>

    <div class="flex items-center gap-3 shrink-0">
      <ToggleSwitch
        :model-value="form.isEnabled.value"
        :disabled="form.isBusy.value"
        @update:model-value="form.setEnabled"
      />
      <Select
        :model-value="form.color.value"
        :options="form.colors"
        :disabled="!form.isEnabled.value || form.isBusy.value"
        size="small"
        class="w-36"
        @update:model-value="form.setColor"
      />
    </div>
  </div>
</template>
