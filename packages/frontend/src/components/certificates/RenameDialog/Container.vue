<script setup lang="ts">
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";

import { useForm } from "./useForm";

defineOptions({ name: "RenameDialog" });

const visible = defineModel<boolean>("visible", { default: false });

const { currentLabel, isBusy = false } = defineProps<{
  currentLabel: string;
  isBusy?: boolean;
}>();

const emit = defineEmits<{ rename: [label: string] }>();

const form = useForm({
  visible,
  currentLabel: () => currentLabel,
  rename: (label) => emit("rename", label),
});
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Rename certificate"
    :style="{ width: '480px', maxWidth: '92vw' }"
    @show="form.reset"
  >
    <label class="flex flex-col gap-1.5">
      <span class="text-sm font-medium text-surface-200">
        Certificate name
      </span>
      <InputText
        v-model="form.label.value"
        maxlength="200"
        :invalid="form.error.value !== ''"
        autofocus
        @keyup.enter="form.submit"
      />
    </label>
    <p v-if="form.error.value !== ''" class="mt-2 text-xs text-red-300">
      {{ form.error.value }}
    </p>

    <template #footer>
      <Button
        label="Cancel"
        size="small"
        severity="secondary"
        outlined
        :disabled="isBusy"
        @click="form.close"
      />
      <Button
        label="Rename"
        size="small"
        :loading="isBusy"
        :disabled="form.error.value !== ''"
        @click="form.submit"
      />
    </template>
  </Dialog>
</template>
