import { computed, type MaybeRefOrGetter, type Ref, ref, toValue } from "vue";

export const useForm = (options: {
  visible: Ref<boolean>;
  currentLabel: MaybeRefOrGetter<string>;
  rename: (label: string) => void;
}) => {
  const label = ref("");
  const error = computed(() => {
    const trimmed = label.value.trim();
    if (trimmed === "") return "A name is required.";
    if (trimmed.length > 200) {
      return "A name may be at most 200 characters.";
    }
    return "";
  });

  return {
    label,
    error,
    reset: () => {
      label.value = toValue(options.currentLabel);
    },
    close: () => {
      options.visible.value = false;
    },
    submit: () => {
      if (error.value !== "") return;
      options.rename(label.value.trim());
    },
  };
};
