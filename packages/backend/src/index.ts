import type { DefineAPI, SDK } from "caido:plugin";

export type API = DefineAPI<Record<string, never>>;

export function init(_sdk: SDK<API>) {}
