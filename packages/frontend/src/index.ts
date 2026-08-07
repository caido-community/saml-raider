import { Classic } from "@caido/primevue";
import {
  type RequestViewModeOptions,
  type ResponseViewModeOptions,
} from "@caido/sdk-frontend";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import Tooltip from "primevue/tooltip";
import { createApp, defineComponent, h, markRaw } from "vue";

import { MessageView } from "./components/samlMessage/MessageView";
import { analyzeSamlMessage, applyParameterNames, isSamlMessage } from "./core";
import {
  buildCertificateService,
  setCertificateService,
} from "./services/certificates";
import {
  applyHighlightSettings,
  buildHighlightService,
} from "./services/highlight";
import {
  forgetImportedCertificates,
  trackImportedCertificates,
} from "./services/imported";
import { setNotificationSink } from "./services/notifications";
import { buildPreferenceService } from "./services/preferences";
import "./styles/index.css";
import type { FrontendSDK } from "./types";
import App from "./views/App.vue";

export const carriesSamlMessage = (raw: string): boolean =>
  isSamlMessage(analyzeSamlMessage(raw));

const registerViewModes = (sdk: FrontendSDK) => {
  const view = {
    component: markRaw(
      defineComponent({
        name: "SamlMessageViewHost",
        inheritAttrs: false,
        setup:
          (_props, { attrs }) =>
          () =>
            h(MessageView, { ...attrs }),
      }),
    ),
  };

  const request: RequestViewModeOptions = {
    label: "SAML",
    view,
    when: (candidate) => carriesSamlMessage(candidate.raw),
  };

  const response: ResponseViewModeOptions = {
    label: "SAML",
    view,
    when: (candidate) => carriesSamlMessage(candidate.raw),
  };

  sdk.replay.addRequestViewMode(request);
  sdk.intercept.addRequestViewMode(request);
  sdk.httpHistory.addRequestViewMode(request);
  sdk.search.addRequestViewMode(request);
  sdk.sitemap.addRequestViewMode(request);
  sdk.automate.addRequestViewMode(request);
  sdk.findings.addRequestViewMode(request);

  sdk.replay.addResponseViewMode(response);
  sdk.intercept.addResponseViewMode(response);
  sdk.httpHistory.addResponseViewMode(response);
  sdk.search.addResponseViewMode(response);
  sdk.sitemap.addResponseViewMode(response);
  sdk.automate.addResponseViewMode(response);
  sdk.findings.addResponseViewMode(response);
};

const loadPreferences = async (sdk: FrontendSDK) => {
  const service = buildPreferenceService(sdk);

  const names = await service.getParameterNames();
  if (names.kind === "Ok") applyParameterNames(names.value);

  const highlight = await service.getHighlightSettings();
  if (highlight.kind === "Ok") applyHighlightSettings(highlight.value);
};

const registerHighlighting = (sdk: FrontendSDK) => {
  const highlight = buildHighlightService(sdk);

  sdk.backend.onEvent("samlDetected", (requestId) => {
    void highlight.colorRequest(requestId);
  });
};

export const init = (sdk: FrontendSDK) => {
  setCertificateService(buildCertificateService(sdk));
  setNotificationSink({
    showSuccess: (message) =>
      sdk.window.showToast(message, { variant: "success" }),
    showError: (message) => sdk.window.showToast(message, { variant: "error" }),
  });
  void loadPreferences(sdk);
  registerHighlighting(sdk);

  const app = createApp(App, { sdk: markRaw(sdk) });

  app.use(PrimeVue, {
    unstyled: true,
    pt: Classic,
  });
  app.use(ConfirmationService);
  app.directive("tooltip", Tooltip);

  const root = document.createElement("div");
  Object.assign(root.style, {
    height: "100%",
    width: "100%",
  });

  root.id = `plugin--${__PLUGIN_ID__}`;

  app.mount(root);

  sdk.navigation.addPage(`/${__PLUGIN_ID__}`, {
    body: root,
  });

  trackImportedCertificates(
    sdk.sidebar.registerItem("SAML Raider", `/${__PLUGIN_ID__}`, {
      icon: "fas fa-certificate",
    }),
  );

  sdk.navigation.onPageChange((event) => {
    if (event.path === `/${__PLUGIN_ID__}`) forgetImportedCertificates();
  });

  registerViewModes(sdk);
};
