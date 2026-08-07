<script setup lang="ts">
import Group from "./Group.vue";
import { useForm } from "./useForm";

import { EmbeddedCertificates } from "@/components/samlMessage/EmbeddedCertificates";
import { type Compression, type SamlMessageInfo } from "@/core";
import { type CertificateService } from "@/services/certificates";
import { isPresent, type Maybe } from "@/utils";

defineOptions({ name: "MessageInfo" });

const {
  info,
  compression,
  service = undefined,
} = defineProps<{
  info: SamlMessageInfo;
  compression: Compression;
  service?: Maybe<CertificateService>;
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
      v-if="info.certificates.length > 0 && isPresent(service)"
      :certificates="info.certificates"
      :service="service"
    />
  </div>
</template>
