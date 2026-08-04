<script setup lang="ts">
import Card from "primevue/card";

import { PageHeader } from "@/components/common/PageHeader";
import { CertificateBackups } from "@/components/settings/CertificateBackups";
import { ParameterNamesSettings } from "@/components/settings/ParameterNamesSettings";
import { type CertificateService } from "@/services/certificates";
import { type PreferenceService } from "@/services/preferences";
import { type NotificationSink } from "@/types";

defineOptions({ name: "SettingsPage" });

const { certificateService, preferenceService, notifications } = defineProps<{
  certificateService: CertificateService;
  preferenceService: PreferenceService;
  notifications: NotificationSink;
}>();
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-1">
    <PageHeader
      title="Settings"
      description="Configure SAML message detection and certificate backups."
    />

    <div class="flex-1 min-h-0 overflow-auto flex flex-col gap-1">
      <Card
        class="shrink-0"
        :pt="{ body: { class: 'p-0' }, content: { class: 'p-0' } }"
      >
        <template #content>
          <ParameterNamesSettings
            :service="preferenceService"
            :notifications="notifications"
          />
        </template>
      </Card>

      <div class="flex-1" />

      <Card
        class="shrink-0"
        :pt="{ body: { class: 'p-0' }, content: { class: 'p-0' } }"
      >
        <template #content>
          <CertificateBackups
            :service="certificateService"
            :notifications="notifications"
          />
        </template>
      </Card>
    </div>
  </div>
</template>
