<script setup lang="ts">
import Group from "./Group.vue";
import { useForm } from "./useForm";

import { XmlView } from "@/components/common/XmlView";
import { EmbeddedCertificates } from "@/components/samlMessage/EmbeddedCertificates";
import { type Compression, type SamlMessageInfo } from "@/core";
import { type FrontendSDK } from "@/types";
import { isPresent, type Maybe } from "@/utils";

defineOptions({ name: "MessageInfo" });

const {
  info,
  prettyXml,
  compression,
  sdk = undefined,
} = defineProps<{
  info: SamlMessageInfo;
  prettyXml: string;
  compression: Compression;
  sdk?: Maybe<FrontendSDK>;
}>();

const { rows } = useForm(
  () => info,
  () => compression,
);
</script>

<template>
  <div class="w-full min-w-0 flex flex-col gap-2 p-2">
    <div
      v-for="row in rows"
      :key="row.key"
      class="grid gap-2 min-w-0"
      :class="row.groups.length > 1 ? 'grid-cols-2' : 'grid-cols-1'"
    >
      <Group v-for="group in row.groups" :key="group.title" :group="group" />
    </div>

    <EmbeddedCertificates
      v-if="info.certificates.length > 0 && isPresent(sdk)"
      :certificates="info.certificates"
      :sdk="sdk"
    />

    <section
      class="min-w-0 flex flex-col border border-surface-700 rounded overflow-hidden"
    >
      <header
        class="px-2 py-1 text-xs font-bold uppercase tracking-wide text-surface-300 bg-surface-800/60"
      >
        Parsed &amp; Prettified
      </header>
      <div class="min-w-0">
        <XmlView :content="prettyXml" />
      </div>
    </section>
  </div>
</template>
