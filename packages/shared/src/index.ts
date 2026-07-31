import type { DefinePluginPackageSpec } from "@caido/sdk-shared";

import type { API } from "./api";
import type { Events } from "./events";

export type Spec = DefinePluginPackageSpec<{
  manifestId: "saml-raider";
  api: API;
  events: Events;
}>;

export type { API } from "./api";
export type { Events } from "./events";
