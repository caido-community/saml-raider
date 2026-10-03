<script setup lang="ts">
import Button from "primevue/button";
import InputText from "primevue/inputtext";

import { useForm } from "./useForm";

import { type PreferenceService } from "@/services/preferences";
import { type NotificationSink } from "@/types";

defineOptions({ name: "ParameterNamesSettings" });

const { service, notifications } = defineProps<{
  service: PreferenceService;
  notifications: NotificationSink;
}>();

const form = useForm({ service, notifications });
</script>

<template>
  <div class="p-4 space-y-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h3 class="text-base font-semibold">SAML parameter names</h3>
          <span
            v-if="!form.isDefault.value"
            class="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-300"
          >
            Customized
          </span>
        </div>
        <p class="text-sm text-surface-400">
          The form or query parameters used to detect SAML messages. Changes are
          saved when you leave the field.
        </p>
      </div>
      <Button
        label="Restore defaults"
        size="small"
        severity="secondary"
        outlined
        :disabled="
          form.loadState.value.kind !== 'Ready' || form.isDefault.value
        "
        @click="form.restoreDefaults"
      />
    </div>

    <div
      v-if="form.loadState.value.kind === 'Failed'"
      class="flex flex-wrap items-center gap-3 rounded border border-red-500/40 bg-red-500/10 p-3"
    >
      <p class="flex-1 text-sm text-red-200">
        {{ form.loadState.value.message }}
      </p>
      <Button
        label="Try again"
        icon="fas fa-rotate"
        size="small"
        severity="secondary"
        outlined
        @click="form.load"
      />
    </div>

    <div
      v-else-if="form.loadState.value.kind === 'Loading'"
      class="flex items-center gap-2 text-sm text-surface-400"
    >
      <i class="fas fa-circle-notch fa-spin" />
      <span>Loading parameter names</span>
    </div>

    <div v-else class="grid gap-x-8 gap-y-4 md:grid-cols-2">
      <div class="space-y-2">
        <div>
          <label class="text-sm font-medium block">Request parameter</label>
          <p class="text-xs text-surface-400">
            Used for authentication requests sent to an identity provider.
          </p>
        </div>
        <InputText
          :model-value="form.names.value.samlRequest"
          class="w-full font-mono text-sm"
          @blur="form.saveRequest"
          @keyup.enter="form.saveRequest"
        />
      </div>

      <div class="space-y-2">
        <div>
          <label class="text-sm font-medium block">Response parameter</label>
          <p class="text-xs text-surface-400">
            Used for authentication responses sent to a service provider.
          </p>
        </div>
        <InputText
          :model-value="form.names.value.samlResponse"
          class="w-full font-mono text-sm"
          @blur="form.saveResponse"
          @keyup.enter="form.saveResponse"
        />
      </div>
    </div>
  </div>
</template>
