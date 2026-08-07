<script setup lang="ts">
import Button from "primevue/button";
import Menu from "primevue/menu";
import { type Certificate } from "shared";

import { useForm } from "./useForm";

import { RenameDialog } from "@/components/certificates/RenameDialog";

defineOptions({ name: "CertificateDetail" });

const { certificate, isBusy } = defineProps<{
  certificate: Certificate;
  isBusy: boolean;
}>();

const emit = defineEmits<{
  rename: [label: string];
  remove: [];
  clone: [];
  cloneChain: [];
  exportCertificate: [];
  exportPrivateKey: [];
  attachPrivateKey: [pem: string];
  error: [message: string];
}>();

const form = useForm({ certificate: () => certificate, emit });
</script>

<template>
  <div class="h-full min-h-0 flex flex-col">
    <div
      class="shrink-0 flex items-center justify-between gap-4 p-4 border-b border-surface-700"
    >
      <h3 class="min-w-0 truncate text-lg font-semibold">
        {{ certificate.label }}
      </h3>
      <div class="shrink-0 flex flex-wrap items-center justify-end gap-1.5">
        <span
          v-for="badge in form.badges.value"
          :key="badge.label"
          class="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
          :class="badge.className"
        >
          <i v-if="badge.icon !== undefined" :class="badge.icon" />
          {{ badge.label }}
        </span>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-auto flex flex-col gap-3 p-4">
      <p
        v-if="form.expiry.value.kind !== 'Valid'"
        class="shrink-0 text-xs px-3 py-2 rounded border border-amber-500/40 bg-amber-500/10 text-amber-200"
      >
        <i class="fas fa-triangle-exclamation mr-1.5" />
        {{ form.expiry.value.message }}
      </p>

      <section
        v-for="group in form.groups.value"
        :key="group.title"
        class="shrink-0 rounded border border-surface-700 overflow-hidden"
      >
        <header
          class="flex items-center gap-2 px-3 py-2 bg-surface-800/50 border-b border-surface-700"
        >
          <h4 class="text-sm font-semibold text-surface-200">
            {{ group.title }}
          </h4>
          <i
            v-if="group.isSigned"
            v-tooltip.right="'Covered by the certificate signature'"
            class="fas fa-lock text-[10px] text-surface-500"
          />
        </header>
        <dl
          class="grid grid-cols-[minmax(8rem,max-content)_minmax(0,1fr)] gap-x-5 gap-y-2 p-3"
        >
          <template v-for="field in group.fields" :key="field.label">
            <dt class="text-xs font-medium text-surface-400">
              {{ field.label }}
            </dt>
            <dd class="text-xs text-surface-200 break-all select-text">
              {{ field.value }}
            </dd>
          </template>
        </dl>
      </section>
    </div>

    <div
      class="shrink-0 flex flex-wrap items-center justify-between gap-2 p-4 border-t border-surface-700"
    >
      <Button
        label="Delete"
        icon="fas fa-trash"
        severity="danger"
        outlined
        size="small"
        :disabled="isBusy"
        @click="form.confirmRemove"
      />

      <div class="flex flex-wrap items-center gap-2">
        <Button
          label="Rename"
          icon="fas fa-pen"
          plain
          outlined
          class="!text-surface-200"
          size="small"
          :disabled="isBusy"
          @click="form.openRename"
        />
        <Button
          v-if="form.hasPrivateKey.value"
          label="Export key"
          icon="fas fa-key"
          plain
          outlined
          class="!text-surface-200"
          size="small"
          :disabled="isBusy"
          @click="form.confirmExportPrivateKey"
        />
        <Button
          v-else
          label="Attach key"
          icon="fas fa-key"
          plain
          outlined
          class="!text-surface-200"
          size="small"
          :disabled="isBusy"
          @click="form.attachPrivateKey"
        />
        <Button
          v-tooltip.top="'More actions'"
          icon="fas fa-ellipsis"
          plain
          outlined
          class="!text-surface-200"
          size="small"
          aria-label="More actions"
          :disabled="isBusy"
          @click="form.toggleMore"
        />
        <Menu :ref="form.setMoreMenu" :model="form.moreActions.value" popup />
        <Button
          label="Export"
          icon="fas fa-download"
          size="small"
          :disabled="isBusy"
          @click="form.exportCertificate"
        />
      </div>
    </div>

    <input
      :ref="form.setKeyInput"
      type="file"
      accept=".pem,.key,.der,.p8,.txt"
      class="hidden"
      @change="form.onKeyFile"
    />

    <RenameDialog
      v-model:visible="form.isRenameOpen.value"
      :current-label="certificate.label"
      :is-busy="isBusy"
      @rename="form.rename"
    />
  </div>
</template>
