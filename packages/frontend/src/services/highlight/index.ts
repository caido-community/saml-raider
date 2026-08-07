import { type HighlightSettings } from "shared";

import { type FrontendSDK } from "@/types";
import { isAbsent } from "@/utils";

export type HighlightService = {
  colorRequest: (requestId: string) => Promise<void>;
};

let current: HighlightSettings = {
  isEnabled: false,
  color: "blue",
};

export const applyHighlightSettings = (settings: HighlightSettings) => {
  current = settings;
};

const readMetadataId = async (
  sdk: FrontendSDK,
  requestId: string,
): Promise<string | undefined> => {
  const found = await sdk.graphql.request({ id: requestId });
  return found.request?.metadata.id;
};

export const buildHighlightService = (sdk: FrontendSDK): HighlightService => ({
  colorRequest: async (requestId: string) => {
    const settings = current;
    if (!settings.isEnabled) return;

    const metadataId = await readMetadataId(sdk, requestId);
    if (isAbsent(metadataId)) return;

    await sdk.graphql.updateRequestMetadata({
      id: metadataId,
      input: { color: `var(--c-highlight-color-${settings.color})` },
    });
  },
});
