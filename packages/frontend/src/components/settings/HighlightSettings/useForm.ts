import { HIGHLIGHT_COLORS, type HighlightSettings } from "shared";
import { computed, type ComputedRef, ref, type Ref } from "vue";

import { applyHighlightSettings } from "@/services/highlight";
import { type PreferenceService } from "@/services/preferences";
import { type NotificationSink } from "@/types";

export type HighlightForm = {
  isEnabled: Ref<boolean>;
  color: Ref<string>;
  colors: ReadonlyArray<string>;
  isBusy: ComputedRef<boolean>;
  load: () => Promise<void>;
  setEnabled: (value: boolean) => Promise<void>;
  setColor: (value: string) => Promise<void>;
};

export const useForm = (options: {
  service: PreferenceService;
  notifications: NotificationSink;
}): HighlightForm => {
  const isEnabled = ref(false);
  const color = ref("blue");
  const pending = ref(0);

  const remember = (settings: HighlightSettings) => {
    isEnabled.value = settings.isEnabled;
    color.value = settings.color;
    applyHighlightSettings(settings);
  };

  const persist = async (previous: HighlightSettings) => {
    pending.value += 1;
    const saved = await options.service.setHighlightSettings({
      isEnabled: isEnabled.value,
      color: color.value,
    });
    pending.value -= 1;

    if (saved.kind === "Error") {
      remember(previous);
      options.notifications.showError(saved.error);
      return;
    }
    remember(saved.value);
  };

  return {
    isEnabled,
    color,
    colors: HIGHLIGHT_COLORS,
    isBusy: computed(() => pending.value > 0),

    load: async () => {
      pending.value += 1;
      const stored = await options.service.getHighlightSettings();
      pending.value -= 1;

      if (stored.kind === "Error") {
        options.notifications.showError(stored.error);
        return;
      }
      remember(stored.value);
    },

    setEnabled: async (value: boolean) => {
      const previous = { isEnabled: isEnabled.value, color: color.value };
      isEnabled.value = value;
      await persist(previous);
    },

    setColor: async (value: string) => {
      const previous = { isEnabled: isEnabled.value, color: color.value };
      color.value = value;
      await persist(previous);
    },
  };
};
