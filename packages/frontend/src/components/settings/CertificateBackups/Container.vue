<script setup lang="ts">
import Button from "primevue/button";

import { useForm } from "./useForm";

import { ExportBackupDialog } from "@/components/certificates/ExportBackupDialog";
import { type CertificateService } from "@/services/certificates";
import { type NotificationSink } from "@/types";

defineOptions({ name: "CertificateBackups" });

const { service, notifications } = defineProps<{
  service: CertificateService;
  notifications: NotificationSink;
}>();

const form = useForm({ service, notifications });
</script>

<template>
  <div class="p-4 space-y-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h3 class="text-base font-semibold">Certificate backups</h3>
        <p class="text-sm text-surface-400">
          Certificates live with this plugin and are not part of a Caido project
          backup. Export them before uninstalling or moving machine.
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Button
          label="Restore"
          icon="fas fa-rotate-left"
          size="small"
          severity="secondary"
          outlined
          :loading="form.isRestoring.value"
          :disabled="form.isBusy.value"
          @click="form.openRestore"
        />
        <Button
          label="Export"
          icon="fas fa-download"
          size="small"
          severity="secondary"
          outlined
          :disabled="form.isBusy.value"
          @click="form.openExport"
        />
      </div>
    </div>

    <p
      class="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100"
    >
      <i class="fas fa-shield-halved mt-0.5 shrink-0" />
      <span>
        A backup that includes private keys is not encrypted. Store it with the
        same care as the keys themselves.
      </span>
    </p>

    <input
      :ref="form.setBackupInput"
      type="file"
      accept=".json"
      class="hidden"
      @change="form.onBackupFile"
    />

    <ExportBackupDialog
      v-model:visible="form.isExportOpen.value"
      :is-busy="form.isExporting.value"
      :error="form.error.value"
      @export="form.exportBackup"
    />
  </div>
</template>
