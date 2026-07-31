<script setup lang="ts">
defineOptions({ name: "App" });
</script>

<template>
  <div
    class="h-full bg-surface-800 flex flex-col items-center justify-center gap-3 p-4"
  >
    <i class="fas fa-shield-halved text-3xl text-surface-400 opacity-60" />
    <h1 class="text-base font-bold text-surface-200">SAML Raider</h1>
    <p class="max-w-md text-center text-sm text-surface-400">
      Open a request or response carrying a SAML message in History, Replay,
      Intercept, Search, Sitemap, Automate or Findings, then pick the
      <span class="text-surface-200">SAML</span> view mode above it to decode
      and inspect it.
    </p>
  </div>
</template>
