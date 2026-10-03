import { type Maybe } from "@/utils";

export const decodeUri = (value: string): Maybe<string> => {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
};
