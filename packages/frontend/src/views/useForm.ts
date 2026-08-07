import { ref } from "vue";

import { buildCertificateService } from "@/services/certificates";
import { buildPreferenceService } from "@/services/preferences";
import { type FrontendSDK, type NotificationSink } from "@/types";

type Page = "Certificates" | "Settings";

const PAGES: ReadonlyArray<Page> = ["Certificates", "Settings"];

export const useForm = (sdk: FrontendSDK) => {
  const page = ref<Page>("Certificates");

  const notifications: NotificationSink = {
    showSuccess: (message) =>
      sdk.window.showToast(message, { variant: "success" }),
    showError: (message) => sdk.window.showToast(message, { variant: "error" }),
  };

  return {
    page,
    pages: PAGES,
    certificateService: buildCertificateService(sdk),
    preferenceService: buildPreferenceService(sdk),
    notifications,
    selectPage: (nextPage: Page) => {
      page.value = nextPage;
    },
  };
};
