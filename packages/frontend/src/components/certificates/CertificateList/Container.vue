<script setup lang="ts">
import Button from "primevue/button";
import { type Certificate } from "shared";

import { useForm } from "./useForm";

import { type Maybe } from "@/utils";

defineOptions({ name: "CertificateList" });

const {
  certificates,
  filter,
  selectedId = undefined,
} = defineProps<{
  certificates: Certificate[];
  filter: string;
  selectedId?: Maybe<string>;
}>();

const emit = defineEmits<{
  select: [id: string];
  clearFilter: [];
}>();

const form = useForm({
  certificates: () => certificates,
  filter: () => filter,
  select: (id) => emit("select", id),
  clearFilter: () => emit("clearFilter"),
});
</script>

<template>
  <div
    class="h-full min-h-0 overflow-y-auto"
    role="listbox"
    aria-label="Stored certificates"
  >
    <div
      v-if="form.rows.value.length === 0 && form.hasFilter.value"
      class="flex flex-col items-center gap-2 py-6 text-center"
    >
      <p class="text-sm text-surface-400">No matching certificates</p>
      <Button
        label="Clear filter"
        size="small"
        severity="secondary"
        text
        @click="form.clearFilter"
      />
    </div>

    <button
      v-for="(row, index) in form.rows.value"
      v-else
      :key="row.certificate.id"
      :ref="(element) => form.setButton(index, element)"
      type="button"
      role="option"
      class="w-full text-left px-3 py-2 border-b border-surface-700/60 outline-none transition-colors hover:bg-surface-700/35 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-inset"
      :class="
        row.certificate.id === selectedId
          ? 'bg-surface-700/60'
          : 'bg-transparent'
      "
      :aria-selected="row.certificate.id === selectedId"
      @click="form.select(row.certificate.id)"
      @keydown.down.prevent="form.move(index, 1)"
      @keydown.up.prevent="form.move(index, -1)"
      @keydown.home.prevent="form.move(index, -form.rows.value.length)"
      @keydown.end.prevent="form.move(index, form.rows.value.length)"
    >
      <div
        class="flex items-center gap-2 min-w-0"
        :style="form.readIndent(row.depth)"
      >
        <i
          class="fas fa-certificate text-xs"
          :class="
            row.certificate.details.basicConstraints?.isCertificateAuthority
              ? 'text-amber-400'
              : 'text-surface-400'
          "
        />
        <span class="text-sm text-surface-200 truncate flex-1">
          {{ row.certificate.label }}
        </span>
        <i
          v-if="row.certificate.hasPrivateKey"
          class="fas fa-key text-xs text-green-400"
          title="Private key available"
        />
        <i
          v-if="form.isExpired(row.certificate.details.notAfter)"
          class="fas fa-clock text-xs text-red-400"
          title="Expired"
        />
      </div>
      <div
        class="mt-0.5 text-xs text-surface-500 truncate"
        :style="form.readIndent(row.depth, 20)"
      >
        {{ row.certificate.source }} ·
        {{ row.certificate.details.fingerprintSha256.slice(0, 16) }}…
      </div>
    </button>
  </div>
</template>
