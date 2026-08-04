<script setup lang="ts">
import Button from "primevue/button";
import Dialog from "primevue/dialog";

import { useForm } from "./useForm";

import { buildCertificateService } from "@/services/certificates";
import { type FrontendSDK } from "@/types";
import { formatHex } from "@/utils";

defineOptions({ name: "EmbeddedCertificates" });

const { certificates, sdk } = defineProps<{
  certificates: string[];
  sdk: FrontendSDK;
}>();

const form = useForm(() => certificates, buildCertificateService(sdk));
</script>

<template>
  <section class="border border-surface-700 rounded overflow-hidden">
    <header
      class="px-2 py-1 text-xs font-bold uppercase tracking-wide text-surface-300 bg-surface-800/60"
    >
      Embedded Certificates
    </header>

    <div class="px-2 py-1.5 flex items-center gap-3">
      <p class="text-xs text-surface-400 flex-1">
        {{ certificates.length }} certificate{{
          certificates.length === 1 ? "" : "s"
        }}
        found in this message. Being present here says nothing about whether the
        certificate is trusted, or whether it signed anything.
      </p>
      <Button
        label="Review and send"
        icon="fas fa-file-export"
        size="small"
        severity="contrast"
        @click="form.review"
      />
    </div>

    <Dialog
      v-model:visible="form.isOpen.value"
      modal
      header="Send certificates to the certificate manager"
      :style="{ width: '640px', maxWidth: '92vw' }"
    >
      <p
        v-if="form.state.value.kind === 'Loading'"
        class="text-sm text-surface-400"
      >
        Reading certificates…
      </p>

      <div v-else class="flex flex-col gap-2">
        <p class="text-xs text-surface-400">
          These certificates were taken from this message. Storing one records
          it for later use; it does not mark it as trusted and does not verify
          any signature.
        </p>

        <ul class="flex flex-col gap-1.5">
          <li
            v-for="row in form.rows.value"
            :key="row.key"
            class="border border-surface-700 rounded px-2 py-1.5"
          >
            <div class="flex items-center gap-2">
              <i
                :class="
                  row.isAlreadyStored
                    ? 'fas fa-check text-green-400'
                    : 'fas fa-plus text-surface-400'
                "
                class="text-xs"
              />
              <span class="text-xs text-surface-300">
                {{ row.isAlreadyStored ? "Already stored" : "New" }}
              </span>
            </div>
            <p class="text-xs text-surface-400 break-all pl-5">
              SHA-256 {{ formatHex(row.fingerprintSha256) }}
            </p>
          </li>
        </ul>

        <p v-if="form.message.value !== ''" class="text-xs text-surface-300">
          {{ form.message.value }}
        </p>
      </div>

      <template #footer>
        <Button
          label="Cancel"
          size="small"
          severity="contrast"
          text
          @click="form.close"
        />
        <Button
          :label="`Send ${form.newCount.value} certificate${form.newCount.value === 1 ? '' : 's'}`"
          size="small"
          :disabled="form.isBusy.value || form.newCount.value === 0"
          @click="form.send"
        />
      </template>
    </Dialog>
  </section>
</template>
