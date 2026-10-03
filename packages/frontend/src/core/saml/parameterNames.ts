import { DEFAULT_PARAMETER_NAMES, type ParameterNames } from "shared";

let current: ParameterNames = DEFAULT_PARAMETER_NAMES;

export const readParameterNames = (): ParameterNames => current;

export const applyParameterNames = (names: ParameterNames): void => {
  current = names;
};
