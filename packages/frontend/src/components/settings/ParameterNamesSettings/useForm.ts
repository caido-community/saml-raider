import { DEFAULT_PARAMETER_NAMES, type ParameterNames } from "shared";
import { computed, type ComputedRef, onMounted, ref, type Ref } from "vue";

import { applyParameterNames } from "@/core";
import { type PreferenceService } from "@/services/preferences";
import { type NotificationSink } from "@/types";

type LoadState =
  | { kind: "Loading" }
  | { kind: "Failed"; message: string }
  | { kind: "Ready" };

export type ParameterNamesForm = {
  names: Ref<ParameterNames>;
  loadState: Ref<LoadState>;
  isDefault: ComputedRef<boolean>;
  load: () => Promise<void>;
  saveRequest: (event: Event) => Promise<void>;
  saveResponse: (event: Event) => Promise<void>;
  restoreDefaults: () => Promise<void>;
};

const readValue = (event: Event): string =>
  (event.target as HTMLInputElement).value;

export const useForm = (options: {
  service: PreferenceService;
  notifications: NotificationSink;
}): ParameterNamesForm => {
  const names = ref<ParameterNames>({ ...DEFAULT_PARAMETER_NAMES });
  const loadState = ref<LoadState>({ kind: "Loading" });

  const isDefault = computed(
    () =>
      names.value.samlRequest === DEFAULT_PARAMETER_NAMES.samlRequest &&
      names.value.samlResponse === DEFAULT_PARAMETER_NAMES.samlResponse,
  );

  const load = async () => {
    loadState.value = { kind: "Loading" };
    const result = await options.service.getParameterNames();
    if (result.kind === "Error") {
      loadState.value = { kind: "Failed", message: result.error };
      return;
    }

    names.value = result.value;
    applyParameterNames(result.value);
    loadState.value = { kind: "Ready" };
  };

  let pending: Promise<void> = Promise.resolve();

  const save = (
    build: (current: ParameterNames) => ParameterNames,
  ): Promise<void> => {
    pending = pending.then(() => write(build(names.value)));
    return pending;
  };

  const write = async (next: ParameterNames) => {
    if (loadState.value.kind !== "Ready") return;
    if (
      next.samlRequest === names.value.samlRequest &&
      next.samlResponse === names.value.samlResponse
    ) {
      return;
    }

    const result = await options.service.setParameterNames(next);
    if (result.kind === "Error") {
      options.notifications.showError(
        "Unable to save SAML parameter names: " + result.error,
      );
      await load();
      return;
    }

    names.value = result.value;
    applyParameterNames(result.value);
  };

  onMounted(load);

  return {
    names,
    loadState,
    isDefault,
    load,
    saveRequest: (event: Event) => {
      const samlRequest = readValue(event);
      return save((current) => ({ ...current, samlRequest }));
    },
    saveResponse: (event: Event) => {
      const samlResponse = readValue(event);
      return save((current) => ({ ...current, samlResponse }));
    },
    restoreDefaults: () => save(() => ({ ...DEFAULT_PARAMETER_NAMES })),
  };
};
