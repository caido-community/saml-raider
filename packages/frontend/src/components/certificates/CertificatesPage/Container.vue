<script setup lang="ts">
import Button from "primevue/button";
import Card from "primevue/card";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import InputText from "primevue/inputtext";

import { useForm } from "./useForm";

import { CertificateDetail } from "@/components/certificates/CertificateDetail";
import { CertificateList } from "@/components/certificates/CertificateList";
import { SelfSignedCertificateDialog } from "@/components/certificates/SelfSignedCertificateDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { type CertificateService } from "@/services/certificates";
import { type NotificationSink } from "@/types";

defineOptions({ name: "CertificatesPage" });

const { service, notifications } = defineProps<{
  service: CertificateService;
  notifications: NotificationSink;
}>();

const form = useForm({ service, notifications });
</script>

<template>
  <div class="h-full min-h-0 flex gap-1">
    <Card
      class="w-72 shrink-0"
      pt:body:class="h-full p-0 flex flex-col"
      pt:content:class="h-full flex flex-col min-h-0"
    >
      <template #content>
        <div class="h-full min-h-0 flex flex-col">
          <div class="flex flex-col gap-3 p-3">
            <div class="flex items-center gap-2">
              <Button
                label="Import certificate"
                icon="fas fa-file-import"
                size="small"
                class="flex-1"
                :disabled="form.isBusy.value"
                @click="form.openCertificatePicker"
              />
              <Button
                v-tooltip.bottom="'Refresh certificates'"
                icon="fas fa-rotate"
                severity="secondary"
                text
                size="small"
                aria-label="Refresh certificates"
                :loading="form.isRefreshing.value"
                :disabled="form.isBusy.value && !form.isRefreshing.value"
                @click="form.refresh"
              />
            </div>

            <IconField>
              <InputIcon class="fas fa-magnifying-glass" />
              <InputText
                :model-value="form.filter.value"
                placeholder="Search..."
                size="small"
                class="w-full"
                aria-label="Filter certificates"
                @update:model-value="form.applyFilter"
              />
            </IconField>
          </div>

          <div class="flex-1 min-h-0 overflow-auto px-3">
            <CertificateList
              :certificates="form.certificates.value"
              :filter="form.filter.value"
              :selected-id="form.selectedId.value"
              @select="form.select"
              @clear-filter="form.clearFilter"
            />
          </div>

          <div class="p-3 border-t border-surface-700">
            <Button
              label="New self-signed"
              icon="fas fa-plus"
              severity="secondary"
              outlined
              size="small"
              class="w-full"
              :disabled="form.isBusy.value"
              @click="form.openCreateDialog"
            />
          </div>
        </div>
      </template>
    </Card>

    <Card
      class="flex-1 min-h-0"
      pt:body:class="h-full p-0 flex flex-col"
      pt:content:class="h-full flex flex-col min-h-0"
    >
      <template #content>
        <div
          v-if="form.page.value.kind === 'Loading'"
          class="h-full flex items-center justify-center gap-2 text-sm text-surface-400"
        >
          <i class="fas fa-circle-notch fa-spin" />
          <span>Loading certificates</span>
        </div>

        <EmptyState
          v-else-if="form.page.value.kind === 'Failed'"
          icon="fas fa-triangle-exclamation"
          title="Certificates could not be loaded"
          :message="form.page.value.message"
        >
          <Button
            label="Try again"
            icon="fas fa-rotate"
            size="small"
            @click="form.refresh"
          />
        </EmptyState>

        <CertificateDetail
          v-else-if="form.selected.value !== undefined"
          :certificate="form.selected.value"
          :is-busy="form.isBusy.value"
          @rename="form.renameSelected"
          @remove="form.removeSelected"
          @clone="form.cloneSelected"
          @clone-chain="form.cloneSelectedChain"
          @export-certificate="form.exportSelectedCertificate"
          @export-private-key="form.exportSelectedPrivateKey"
          @attach-private-key="form.attachPrivateKeyToSelected"
          @error="form.reportError"
        />

        <EmptyState
          v-else
          icon="fas fa-certificate"
          :title="form.detailPlaceholder.value.title"
          :message="form.detailPlaceholder.value.message"
        >
          <div v-if="form.isEmpty.value" class="flex flex-wrap gap-2">
            <Button
              label="Import certificate"
              icon="fas fa-file-import"
              size="small"
              @click="form.openCertificatePicker"
            />
            <Button
              label="New self-signed"
              icon="fas fa-plus"
              severity="secondary"
              outlined
              size="small"
              @click="form.openCreateDialog"
            />
          </div>
        </EmptyState>
      </template>
    </Card>

    <input
      :ref="form.setCertificateInput"
      type="file"
      accept=".pem,.crt,.cer,.der,.txt"
      class="hidden"
      @change="form.onCertificateFile"
    />

    <SelfSignedCertificateDialog
      v-model:visible="form.isCreateOpen.value"
      :create="form.createSelfSigned"
    />
  </div>
</template>
