export type ParameterNames = {
  samlRequest: string;
  samlResponse: string;
};

export const DEFAULT_PARAMETER_NAMES: ParameterNames = {
  samlRequest: "SAMLRequest",
  samlResponse: "SAMLResponse",
};

export type HighlightSettings = {
  isEnabled: boolean;
  color: string;
};

export const HIGHLIGHT_COLORS: ReadonlyArray<string> = [
  "red",
  "green",
  "blue",
  "purple",
];

export const DEFAULT_HIGHLIGHT_SETTINGS: HighlightSettings = {
  isEnabled: false,
  color: "blue",
};
