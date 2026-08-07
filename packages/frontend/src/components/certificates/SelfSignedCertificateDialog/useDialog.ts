import { type ComputedRef, ref, type Ref } from "vue";

import { useConfirm } from "@/composables/useConfirm";
import { type SelfSignedRequest } from "@/services/certificates";

type CreateForm = {
  isDirty: ComputedRef<boolean>;
  isValid: ComputedRef<boolean>;
  reset: () => void;
  buildRequest: () => SelfSignedRequest;
};

export const useDialog = (options: {
  visible: Ref<boolean>;
  form: CreateForm;
  create: (request: SelfSignedRequest) => Promise<boolean>;
}) => {
  const confirm = useConfirm();
  const isSubmitting = ref(false);

  const discard = () => {
    options.form.reset();
    options.visible.value = false;
  };

  const close = () => {
    if (isSubmitting.value) return;
    if (!options.form.isDirty.value) {
      discard();
      return;
    }

    confirm.require({
      header: "Discard this certificate?",
      message: "The certificate details have not been saved.",
      acceptLabel: "Discard",
      isDestructive: true,
      accept: discard,
    });
  };

  const submit = async () => {
    if (!options.form.isValid.value || isSubmitting.value) return;

    isSubmitting.value = true;
    const created = await options.create(options.form.buildRequest());
    isSubmitting.value = false;
    if (!created) return;

    options.form.reset();
    options.visible.value = false;
  };

  return {
    isSubmitting,
    updateVisible: (nextVisible: boolean) => {
      if (nextVisible) {
        options.visible.value = true;
        return;
      }
      close();
    },
    close,
    submit,
  };
};
