<script setup lang="ts">
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import MenuBar from "primevue/menubar";

import { useForm } from "./useForm";

import { CertificatesPage } from "@/components/certificates/CertificatesPage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { type FrontendSDK } from "@/types";

defineOptions({ name: "App" });

const { sdk } = defineProps<{ sdk: FrontendSDK }>();

const form = useForm(sdk);
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-1">
    <MenuBar breakpoint="320px" class="h-12 gap-2 shrink-0">
      <template #start>
        <div class="flex items-center gap-2">
          <div class="px-2 font-bold text-surface-100">SAML Raider</div>
          <Button
            v-for="item in form.pages"
            :key="item"
            :label="item"
            size="small"
            :severity="form.page.value === item ? 'secondary' : 'contrast'"
            :outlined="form.page.value === item"
            :text="form.page.value !== item"
            @click="form.selectPage(item)"
          />
        </div>
      </template>
    </MenuBar>

    <div class="flex-1 min-h-0">
      <CertificatesPage
        v-if="form.page.value === 'Certificates'"
        :service="form.certificateService"
        :notifications="form.notifications"
      />
      <SettingsPage
        v-else
        :certificate-service="form.certificateService"
        :preference-service="form.preferenceService"
        :notifications="form.notifications"
      />
    </div>

    <ConfirmDialog :pt="{ message: { class: 'whitespace-pre-line' } }" />
  </div>
</template>
