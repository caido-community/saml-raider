<script setup lang="ts">
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import DatePicker from "primevue/datepicker";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Select from "primevue/select";

import { useDialog } from "./useDialog";
import { useForm } from "./useForm";

import { type SelfSignedRequest } from "@/services/certificates";

defineOptions({ name: "SelfSignedCertificateDialog" });

const visible = defineModel<boolean>("visible", { default: false });

const { create } = defineProps<{
  create: (request: SelfSignedRequest) => Promise<boolean>;
}>();

const form = useForm();
const dialog = useDialog({ visible, form, create });
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="New self-signed certificate"
    :style="{ width: '680px', maxWidth: '92vw' }"
    :breakpoints="{ '640px': '95vw' }"
    @update:visible="dialog.updateVisible"
  >
    <div class="flex flex-col gap-5">
      <section class="flex flex-col gap-3">
        <div>
          <h3 class="text-sm font-semibold text-surface-100">General</h3>
          <p class="text-xs text-surface-400">
            Choose the name shown in the certificate list.
          </p>
        </div>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-surface-200">
            Certificate name
          </span>
          <InputText
            v-model="form.fields.value.label"
            maxlength="200"
            :invalid="form.fieldErrors.value.label !== undefined"
            autofocus
          />
          <small
            v-if="form.fieldErrors.value.label !== undefined"
            class="text-xs text-red-300"
          >
            {{ form.fieldErrors.value.label }}
          </small>
        </label>
      </section>

      <section class="flex flex-col gap-3 border-t border-surface-700 pt-4">
        <div>
          <h3 class="text-sm font-semibold text-surface-100">Subject</h3>
          <p class="text-xs text-surface-400">
            Describe the identity represented by this certificate.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-200">
              Common name (CN)
            </span>
            <InputText
              v-model="form.fields.value.commonName"
              maxlength="64"
              :invalid="form.fieldErrors.value.commonName !== undefined"
            />
            <small
              v-if="form.fieldErrors.value.commonName !== undefined"
              class="text-xs text-red-300"
            >
              {{ form.fieldErrors.value.commonName }}
            </small>
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-200">
              Organization (O)
            </span>
            <InputText
              v-model="form.fields.value.organization"
              maxlength="64"
              :invalid="form.fieldErrors.value.organization !== undefined"
            />
            <small
              v-if="form.fieldErrors.value.organization !== undefined"
              class="text-xs text-red-300"
            >
              {{ form.fieldErrors.value.organization }}
            </small>
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-200">
              Organizational unit (OU)
            </span>
            <InputText
              v-model="form.fields.value.organizationalUnit"
              maxlength="64"
              :invalid="form.fieldErrors.value.organizationalUnit !== undefined"
            />
            <small
              v-if="form.fieldErrors.value.organizationalUnit !== undefined"
              class="text-xs text-red-300"
            >
              {{ form.fieldErrors.value.organizationalUnit }}
            </small>
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-200">
              Country (C)
            </span>
            <InputText
              v-model="form.fields.value.country"
              maxlength="2"
              :invalid="form.fieldErrors.value.country !== undefined"
            />
            <small
              v-if="form.fieldErrors.value.country !== undefined"
              class="text-xs text-red-300"
            >
              {{ form.fieldErrors.value.country }}
            </small>
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-200">State (ST)</span>
            <InputText
              v-model="form.fields.value.state"
              maxlength="128"
              :invalid="form.fieldErrors.value.state !== undefined"
            />
            <small
              v-if="form.fieldErrors.value.state !== undefined"
              class="text-xs text-red-300"
            >
              {{ form.fieldErrors.value.state }}
            </small>
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-200">
              Locality (L)
            </span>
            <InputText
              v-model="form.fields.value.locality"
              maxlength="128"
              :invalid="form.fieldErrors.value.locality !== undefined"
            />
            <small
              v-if="form.fieldErrors.value.locality !== undefined"
              class="text-xs text-red-300"
            >
              {{ form.fieldErrors.value.locality }}
            </small>
          </label>
        </div>
      </section>

      <section class="flex flex-col gap-3 border-t border-surface-700 pt-4">
        <div>
          <h3 class="text-sm font-semibold text-surface-100">
            Validity and signing
          </h3>
          <p class="text-xs text-surface-400">
            Set the validity period and certificate signature algorithm.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-200">Valid from</span>
            <DatePicker
              v-model="form.fields.value.notBefore"
              date-format="dd/mm/yy"
              show-icon
              class="w-full"
              :invalid="form.fieldErrors.value.notBefore !== undefined"
            />
            <small
              v-if="form.fieldErrors.value.notBefore !== undefined"
              class="text-xs text-red-300"
            >
              {{ form.fieldErrors.value.notBefore }}
            </small>
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-200"
              >Valid until</span
            >
            <DatePicker
              v-model="form.fields.value.notAfter"
              date-format="dd/mm/yy"
              show-icon
              class="w-full"
              :min-date="form.fields.value.notBefore"
              :invalid="form.fieldErrors.value.notAfter !== undefined"
            />
            <small
              v-if="form.fieldErrors.value.notAfter !== undefined"
              class="text-xs text-red-300"
            >
              {{ form.fieldErrors.value.notAfter }}
            </small>
          </label>

          <label class="flex flex-col gap-1.5 col-span-2">
            <span class="text-sm font-medium text-surface-200">
              Signature algorithm
            </span>
            <Select
              v-model="form.fields.value.signatureAlgorithm"
              :options="form.algorithms"
              option-label="label"
              option-value="value"
              class="w-full"
            />
            <small class="text-xs text-surface-500">
              SHA-1 is available only for legacy interoperability.
            </small>
          </label>
        </div>
      </section>

      <section class="flex flex-col gap-3 border-t border-surface-700 pt-4">
        <div>
          <h3 class="text-sm font-semibold text-surface-100">
            Certificate role
          </h3>
          <p class="text-xs text-surface-400">
            Standard SAML signing certificates should remain leaf certificates.
          </p>
        </div>

        <label
          class="flex items-start gap-3 rounded border border-surface-700 p-3"
        >
          <Checkbox
            v-model="form.fields.value.isCertificateAuthority"
            binary
            input-id="isCertificateAuthority"
          />
          <span class="flex flex-col gap-0.5">
            <span class="text-sm font-medium text-surface-200">
              Certificate authority
            </span>
            <span class="text-xs text-surface-400">
              Allow this certificate to issue other certificates.
            </span>
          </span>
        </label>
      </section>
    </div>

    <template #footer>
      <Button
        label="Cancel"
        size="small"
        severity="secondary"
        outlined
        :disabled="dialog.isSubmitting.value"
        @click="dialog.close"
      />
      <Button
        label="Create certificate"
        size="small"
        :loading="dialog.isSubmitting.value"
        :disabled="!form.isValid.value || dialog.isSubmitting.value"
        @click="dialog.submit"
      />
    </template>
  </Dialog>
</template>
