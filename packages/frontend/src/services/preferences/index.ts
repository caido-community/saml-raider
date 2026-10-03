import {
  type HighlightSettings,
  type ParameterNames,
  type Result,
} from "shared";

import { callBackend } from "@/services/call";
import { type FrontendSDK } from "@/types";

export type PreferenceService = {
  getParameterNames: () => Promise<Result<ParameterNames>>;
  setParameterNames: (input: ParameterNames) => Promise<Result<ParameterNames>>;
  getHighlightSettings: () => Promise<Result<HighlightSettings>>;
  setHighlightSettings: (
    input: HighlightSettings,
  ) => Promise<Result<HighlightSettings>>;
};

export const buildPreferenceService = (
  sdk: FrontendSDK,
): PreferenceService => ({
  getParameterNames: () => callBackend(() => sdk.backend.getParameterNames()),
  setParameterNames: (input) =>
    callBackend(() => sdk.backend.setParameterNames(input)),
  getHighlightSettings: () =>
    callBackend(() => sdk.backend.getHighlightSettings()),
  setHighlightSettings: (input) =>
    callBackend(() => sdk.backend.setHighlightSettings(input)),
});
