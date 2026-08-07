<script setup lang="ts">
import SelectButton from "primevue/selectbutton";
import { computed, ref } from "vue";

import Empty from "./Empty.vue";
import {
  applyRawToEditor,
  readMessageSource,
  type ViewModeProps,
} from "./source";
import { useForm } from "./useForm";

import { XmlView } from "@/components/common/XmlView";
import { AttacksPanel } from "@/components/samlMessage/AttacksPanel";
import { MessageInfo } from "@/components/samlMessage/MessageInfo";
import { SignaturePanel } from "@/components/samlMessage/SignaturePanel";
import { buildRawWithSaml } from "@/core";
import { readCertificateService } from "@/services/certificates";
import { isPresent } from "@/utils";

defineOptions({ name: "MessageView", inheritAttrs: false });

const {
  request = undefined,
  draft = undefined,
  response = undefined,
  view = undefined,
} = defineProps<ViewModeProps>();

const service = readCertificateService();

const source = computed(() =>
  readMessageSource({ request, draft, response, view }),
);

const { state, panel, panels, format, formats, messageText, isWritable } =
  useForm(source);

const applied = ref("");

const apply = (xml: string) => {
  const current = source.value;
  const decoded = state.value;

  if (current.kind !== "WritableRequest") {
    applied.value = "This surface is read only, so nothing was written.";
    return;
  }
  if (decoded.kind !== "Message" || decoded.analysis.kind !== "Parameter") {
    applied.value =
      "This message is not carried in a parameter we can rewrite.";
    return;
  }

  const rebuilt = buildRawWithSaml({
    raw: current.raw,
    xml,
    target: {
      name: decoded.analysis.name,
      source: decoded.analysis.source,
      compression: decoded.compression,
    },
    isReadOnly: false,
    isStrippingDetachedSignature: false,
  });

  if (rebuilt.kind === "BlockedByDetachedSignature") {
    applied.value =
      "This redirect carries a detached signature that would become stale. Strip it before writing.";
    return;
  }
  if (rebuilt.kind !== "Ok") {
    applied.value = `Could not rebuild the request: ${rebuilt.reason}.`;
    return;
  }

  const written = applyRawToEditor(
    current.view,
    current.view.state.doc.toString(),
    rebuilt.raw,
  );

  applied.value =
    written.kind === "Written"
      ? "Written into the request."
      : `Refused: ${written.reason}.`;
};
</script>

<template>
  <Empty
    v-if="state.kind === 'Notice'"
    :icon="state.icon"
    :message="state.message"
  />

  <div v-else class="h-full w-full min-w-0 flex flex-col min-h-0">
    <div class="flex items-center gap-2 px-2 py-1 border-b border-surface-700">
      <SelectButton
        v-model="panel"
        :options="panels"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        size="small"
      />
      <div class="flex-1" />
      <span v-if="!isWritable" class="text-xs text-surface-400">
        <i class="fas fa-lock mr-1" />read only
      </span>
      <SelectButton
        v-if="panel === 'Message'"
        v-model="format"
        :options="formats"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        size="small"
      />
    </div>

    <div class="flex-1 min-h-0 min-w-0 overflow-y-auto">
      <XmlView v-if="panel === 'Message'" :content="messageText" />

      <MessageInfo
        v-else-if="panel === 'Info'"
        :info="state.info"
        :compression="state.compression"
        :service="service"
      />

      <div v-else class="p-2 w-full min-w-0 flex flex-col gap-2">
        <template v-if="isPresent(service)">
          <SignaturePanel :xml="state.xml" :service="service" />
          <AttacksPanel
            :xml="state.xml"
            :service="service"
            :is-writable="isWritable"
            @apply="apply"
          />
        </template>
        <p v-else class="text-xs text-surface-400">
          The certificate service is not available, so signatures cannot be
          checked here.
        </p>

        <p v-if="applied !== ''" class="text-xs text-surface-300">
          {{ applied }}
        </p>
      </div>
    </div>
  </div>
</template>
