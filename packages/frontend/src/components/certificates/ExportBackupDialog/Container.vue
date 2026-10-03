<script setup lang="ts">
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Dialog from "primevue/dialog";

import { useForm } from "./useForm";

import { type Maybe } from "@/utils";

defineOptions({ name: "ExportBackupDialog" });

const visible = defineModel<boolean>("visible", { default: false });

const { isBusy = false, error = undefined } = defineProps<{
  isBusy?: boolean;
  error?: Maybe<string>;
}>();

const emit = defineEmits<{ export: [includePrivateKeys: boolean] }>();

const form = useForm((includePrivateKeys) =>
  emit("export", includePrivateKeys),
);
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Export certificate backup"
    :style="{ width: '540px', maxWidth: '92vw' }"
    @show="form.reset"
  >
    <p class="text-sm text-surface-300">
      Choose whether the backup should remain useful for signing or contain
      public certificates only.
    </p>

    <label
      class="mt-4 flex items-start gap-3 rounded border border-surface-700 p-3"
    >
      <Checkbox
        v-model="form.includePrivateKeys.value"
        binary
        input-id="includeKeys"
      />
      <span class="flex flex-col gap-0.5">
        <span class="text-sm font-medium text-surface-200">
          Include private keys
        </span>
        <span class="text-xs text-surface-400">
          Required to restore certificates that can sign SAML messages. The
          exported file is not encrypted.
        </span>
      </span>
    </label>

    <p
      v-if="error !== undefined"
      class="mt-3 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
    >
      {{ error }}
    </p>

    <template #footer>
      <Button
        label="Cancel"
        size="small"
        severity="secondary"
        outlined
        :disabled="isBusy"
        @click="visible = false"
      />
      <Button
        label="Export backup"
        icon="fas fa-download"
        size="small"
        :loading="isBusy"
        @click="form.submit"
      />
    </template>
  </Dialog>
</template>
