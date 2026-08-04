import { type ParameterNames, type Result } from "shared";

import { callBackend } from "@/services/call";
import { type FrontendSDK } from "@/types";

export type PreferenceService = {
  getParameterNames: () => Promise<Result<ParameterNames>>;
  setParameterNames: (input: ParameterNames) => Promise<Result<ParameterNames>>;
};

export const buildPreferenceService = (
  sdk: FrontendSDK,
): PreferenceService => ({
  getParameterNames: () => callBackend(() => sdk.backend.getParameterNames()),
  setParameterNames: (input) =>
    callBackend(() => sdk.backend.setParameterNames(input)),
});
