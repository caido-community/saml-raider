import { useConfirm as usePrimeConfirm } from "primevue/useconfirm";

type ConfirmOptions = {
  header: string;
  message: string;
  acceptLabel: string;
  accept: () => void | Promise<void>;
  isDestructive?: boolean;
};

export const useConfirm = () => {
  const confirm = usePrimeConfirm();

  return {
    require: (options: ConfirmOptions) =>
      confirm.require({
        header: options.header,
        message: options.message,
        accept: options.accept,
        acceptProps: {
          label: options.acceptLabel,
          severity: options.isDestructive === true ? "danger" : undefined,
          size: "small",
        },
        rejectProps: {
          label: "Cancel",
          plain: true,
          outlined: true,
          size: "small",
          class: "!text-surface-200",
        },
      }),
  };
};
