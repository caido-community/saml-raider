<script setup lang="ts">
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import { computed, onMounted } from "vue";

import Card from "./Card.vue";
import Diff from "./Diff.vue";
import Option from "./Option.vue";
import { useForm } from "./useForm";

import { MATCH_MODES } from "@/core";
import { type CertificateService } from "@/services/certificates";
import { isAbsent } from "@/utils";

defineOptions({ name: "AttacksPanel" });

const { xml, service, isWritable } = defineProps<{
  xml: string;
  service: CertificateService;
  isWritable: boolean;
}>();

const emit = defineEmits<{ apply: [xml: string] }>();

const form = useForm(
  () => xml,
  service,
  (next: string) => emit("apply", next),
);

const itemsOf = (group: string) =>
  computed(
    () => form.groups.value.find((entry) => entry.label === group)?.items ?? [],
  );

const wrappingOptions = itemsOf("Signature wrapping");
const cveOptions = itemsOf("Known CVEs");

const PAYLOADS = [
  { value: "Xxe", label: "XXE external entity" },
  { value: "Xslt", label: "XSLT file read" },
];

const reasonOf = (value: string): string =>
  form.groups.value
    .flatMap((group) => group.items)
    .find((item) => item.value === value)?.reason ?? "";

const cannotRun = (value: string): boolean =>
  !isWritable || reasonOf(value) !== "";

const wrappingReason = computed(() =>
  isAbsent(form.wrapping.value) ? "" : reasonOf(form.wrapping.value),
);

const cveReason = computed(() =>
  isAbsent(form.cve.value) ? "" : reasonOf(form.cve.value),
);

const cannotWrap = computed(
  () => isAbsent(form.wrapping.value) || cannotRun(form.wrapping.value),
);

const cannotCve = computed(
  () => isAbsent(form.cve.value) || cannotRun(form.cve.value),
);

onMounted(() => void form.loadCertificates());
</script>

<template>
  <div class="flex flex-col gap-4 min-w-0">
    <p v-if="!isWritable" class="px-1 text-xs text-amber-300">
      <i class="fas fa-lock mr-1" />Read only. Send this request to Replay to
      run attacks against it.
    </p>

    <Card title="Signature Wrapping" hint="XSW1 to XSW8">
      <Select
        v-model="form.wrapping.value"
        :options="wrappingOptions"
        option-label="label"
        option-value="value"
        option-disabled="reason"
        placeholder="Choose a variant"
        :disabled="!isWritable"
        size="small"
        class="w-56"
      >
        <template #option="slot">
          <Option
            :label="slot.option.label"
            :note="slot.option.note"
            :reason="slot.option.reason"
          />
        </template>
      </Select>

      <template #actions>
        <Button
          v-tooltip.left="wrappingReason"
          label="Preview"
          size="small"
          :disabled="cannotWrap"
          @click="form.runWrapping"
        />
      </template>
    </Card>

    <Card title="Signatures">
      <Select
        v-model="form.certificateId.value"
        :options="form.signingCertificates.value"
        option-label="label"
        option-value="id"
        placeholder="Choose a signing certificate"
        :disabled="!isWritable"
        size="small"
        class="w-64"
      />

      <template #actions>
        <Button
          v-tooltip.top="reasonOf('ResignAssertion')"
          label="Re-sign assertion"
          size="small"
          severity="contrast"
          outlined
          :disabled="cannotRun('ResignAssertion')"
          @click="form.previewResign('Assertion')"
        />
        <Button
          v-tooltip.top="reasonOf('ResignMessage')"
          label="Re-sign message"
          size="small"
          severity="contrast"
          outlined
          :disabled="cannotRun('ResignMessage')"
          @click="form.previewResign('Message')"
        />
        <Button
          v-tooltip.left="reasonOf('RemoveSignatures')"
          label="Remove all"
          size="small"
          severity="danger"
          outlined
          class="ml-4"
          :disabled="cannotRun('RemoveSignatures')"
          @click="form.previewRemoveSignatures"
        />
      </template>
    </Card>

    <Card title="Match and Replace">
      <Select
        v-model="form.matchMode.value"
        :options="MATCH_MODES"
        option-label="label"
        option-value="value"
        placeholder="Choose how to match"
        :disabled="!isWritable"
        size="small"
        class="w-44"
      />
      <InputText
        v-model="form.search.value"
        placeholder="Find"
        :disabled="!isWritable"
        size="small"
        class="w-44"
      />
      <InputText
        v-model="form.replacement.value"
        placeholder="Replace with"
        :disabled="!isWritable"
        size="small"
        class="w-44"
      />

      <template #actions>
        <Button
          label="Preview"
          size="small"
          :disabled="form.search.value === '' || !isWritable"
          @click="form.previewReplace"
        />
      </template>
    </Card>

    <Card title="XML Attacks" hint="built as text, never resolved here">
      <Select
        v-model="form.payload.value"
        :options="PAYLOADS"
        option-label="label"
        option-value="value"
        placeholder="Choose a payload"
        :disabled="!isWritable"
        size="small"
        class="w-56"
      />
      <InputText
        v-model="form.callbackUrl.value"
        placeholder="https://your-collaborator"
        :disabled="!isWritable"
        size="small"
        class="w-64"
      />

      <template #actions>
        <Button
          label="Preview"
          size="small"
          :disabled="form.callbackUrl.value === '' || !isWritable"
          @click="form.runPayload"
        />
      </template>
    </Card>

    <Card title="Known CVEs" hint="acceptance by the target is the finding">
      <Select
        v-model="form.cve.value"
        :options="cveOptions"
        option-label="label"
        option-value="value"
        option-disabled="reason"
        placeholder="Choose a published issue"
        :disabled="!isWritable"
        size="small"
        class="w-64"
      >
        <template #option="slot">
          <Option
            :label="slot.option.label"
            :note="slot.option.note"
            :reason="slot.option.reason"
          />
        </template>
      </Select>

      <template #actions>
        <Button
          v-tooltip.left="cveReason"
          label="Preview"
          size="small"
          :disabled="cannotCve"
          @click="form.runCve"
        />
      </template>
    </Card>

    <p
      v-if="form.stage.value.kind === 'Working'"
      class="px-1 text-xs text-surface-400"
    >
      {{ form.stage.value.label }}…
    </p>

    <p
      v-else-if="form.stage.value.kind === 'Refused'"
      class="rounded bg-red-500/10 px-2 py-1.5 text-xs text-red-300"
    >
      {{ form.stage.value.reason }}
    </p>

    <Diff
      v-else-if="form.stage.value.kind === 'Preview'"
      :label="form.stage.value.label"
      :description="form.stage.value.description"
      :effect="form.stage.value.effect"
      :diff="form.stage.value.diff"
      @apply="form.confirm"
      @discard="form.discard"
    />
  </div>
</template>
