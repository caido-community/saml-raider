import { Classic } from "@caido/primevue";
import { type RequestViewModeOptions } from "@caido/sdk-frontend";
import PrimeVue from "primevue/config";
import { createApp, markRaw } from "vue";

import { MessageView } from "./components/samlMessage/MessageView";
import { isLikelySamlMessage } from "./core";
import "./styles/index.css";
import type { FrontendSDK } from "./types";
import App from "./views/App.vue";

const registerViewModes = (sdk: FrontendSDK) => {
  const options: RequestViewModeOptions = {
    label: "SAML",
    view: { component: markRaw(MessageView) },
    when: (request) => isLikelySamlMessage(request.raw),
  };

  sdk.replay.addRequestViewMode(options);
  sdk.intercept.addRequestViewMode(options);
  sdk.httpHistory.addRequestViewMode(options);
  sdk.search.addRequestViewMode(options);
  sdk.sitemap.addRequestViewMode(options);
  sdk.automate.addRequestViewMode(options);
  sdk.findings.addRequestViewMode(options);
};

export const init = (sdk: FrontendSDK) => {
  const app = createApp(App);

  app.use(PrimeVue, {
    unstyled: true,
    pt: Classic,
  });

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

  sdk.sidebar.registerItem("SAML Raider", `/${__PLUGIN_ID__}`);

  registerViewModes(sdk);
};
