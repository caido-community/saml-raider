<script setup lang="ts">
import Button from "primevue/button";

import { useForm } from "./useForm";

import { type CertificateService } from "@/services/certificates";

defineOptions({ name: "SignaturePanel" });

const { xml, service } = defineProps<{
  xml: string;
  service: CertificateService;
}>();

const form = useForm(() => xml, service);
</script>

<template>
  <section class="min-w-0 border border-surface-700 rounded overflow-hidden">
    <header
      class="px-2 py-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-surface-300 bg-surface-800/60"
    >
      <span class="flex-1">Signatures</span>
      <Button
        label="Check"
        icon="fas fa-certificate"
        size="small"
        severity="contrast"
        :disabled="form.isChecking.value"
        @click="form.check"
      />
    </header>

    <p
      v-if="form.state.value.kind === 'Idle'"
      class="px-2 py-1.5 text-xs text-surface-400"
    >
      Check this message to verify its signatures and look for signature
      wrapping.
    </p>

    <p
      v-else-if="form.state.value.kind === 'Checking'"
      class="px-2 py-1.5 text-xs text-surface-400"
    >
      Checking signatures…
    </p>

    <p
      v-else-if="form.state.value.kind === 'Unparseable'"
      class="px-2 py-1.5 text-xs text-red-300"
    >
      This message is not well-formed XML, so its signatures cannot be read.
    </p>

    <p
      v-else-if="form.rows.value.length === 0"
      class="px-2 py-1.5 text-xs text-surface-400"
    >
      This message carries no signature.
    </p>

    <div v-else class="flex flex-col">
      <p
        v-if="form.warning.value !== ''"
        class="mx-2 my-1.5 flex items-start gap-2 rounded bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200"
      >
        <i class="fas fa-triangle-exclamation mt-0.5 shrink-0" />
        <span>{{ form.warning.value }}</span>
      </p>

      <div
        v-for="row in form.rows.value"
        :key="row.index"
        class="flex items-start gap-2 px-2 py-1.5"
      >
        <span
          class="rounded px-1.5 py-0.5 text-xs shrink-0"
          :class="{
            'bg-green-500/10 text-green-300': row.tone === 'Good',
            'bg-red-500/10 text-red-300': row.tone === 'Bad',
            'bg-surface-700/40 text-surface-300': row.tone === 'Unknown',
          }"
        >
          {{ row.label }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-xs text-surface-300">{{ row.detail }}</p>
          <p class="text-xs text-surface-500 truncate">
            covers {{ row.coveredId === "" ? "nothing" : row.coveredId }} · in
            {{ row.parentPath }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
