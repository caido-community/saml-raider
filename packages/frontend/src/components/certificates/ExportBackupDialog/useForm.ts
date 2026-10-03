import { ref } from "vue";

export const useForm = (emit: (includePrivateKeys: boolean) => void) => {
  const includePrivateKeys = ref(true);

  return {
    includePrivateKeys,
    reset: () => {
      includePrivateKeys.value = true;
    },
    submit: () => emit(includePrivateKeys.value),
  };
};
