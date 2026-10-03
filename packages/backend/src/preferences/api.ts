import {
  DEFAULT_HIGHLIGHT_SETTINGS,
  DEFAULT_PARAMETER_NAMES,
  err,
  HIGHLIGHT_COLORS,
  type HighlightSettings,
  ok,
  type ParameterNames,
  type Result,
} from "shared";
import { z } from "zod";

import {
  buildPath,
  type FileSystem,
  PUBLIC_FILE_MODE,
} from "../runtime/fileSystem";

const PREFERENCES_FILE = "preferences.json";

const PREFERENCES_VERSION = 1;

const parameterNamesSchema = z
  .object({
    samlRequest: z.string().trim().min(1).max(128),
    samlResponse: z.string().trim().min(1).max(128),
  })
  .refine(
    (value) => value.samlRequest !== value.samlResponse,
    "the request and response parameter names must differ",
  );

const highlightSettingsSchema = z.object({
  isEnabled: z.boolean(),
  color: z.enum(HIGHLIGHT_COLORS as [string, ...string[]]),
});

const storedPreferencesSchema = z.object({
  version: z.literal(PREFERENCES_VERSION),
  parameterNames: parameterNamesSchema,
  highlight: highlightSettingsSchema.optional(),
});

type Stored = {
  parameterNames: ParameterNames;
  highlight: HighlightSettings;
};

export const buildPreferencesApi = (fileSystem: FileSystem, root: string) => {
  const path = buildPath(root, PREFERENCES_FILE);

  let cached: Stored | undefined = undefined;

  const readFromDisk = async (): Promise<Result<Stored>> => {
    const outcome = await fileSystem.readTextFile(path);
    if (outcome.kind === "Missing") {
      return ok({
        parameterNames: DEFAULT_PARAMETER_NAMES,
        highlight: DEFAULT_HIGHLIGHT_SETTINGS,
      });
    }
    if (outcome.kind === "Failed") {
      return err(
        `The stored preferences could not be read: ${outcome.message}. They were left unchanged.`,
      );
    }

    const content = ((): unknown => {
      try {
        return JSON.parse(outcome.content);
      } catch {
        return undefined;
      }
    })();

    if (content === undefined) {
      return err(
        "The stored preferences could not be read: the file is not valid JSON. It was left unchanged.",
      );
    }

    const parsed = storedPreferencesSchema.safeParse(content);
    if (!parsed.success) {
      return err(
        `The stored preferences could not be read: ${parsed.error.issues[0]?.message ?? "unrecognised format"}. The file was left unchanged.`,
      );
    }

    return ok({
      parameterNames: parsed.data.parameterNames,
      highlight: parsed.data.highlight ?? DEFAULT_HIGHLIGHT_SETTINGS,
    });
  };

  const readStored = async (): Promise<Result<Stored>> => {
    if (cached !== undefined) return ok(cached);

    const loaded = await readFromDisk();
    if (loaded.kind === "Ok") cached = loaded.value;
    return loaded;
  };

  const writeStored = async (stored: Stored): Promise<Result<Stored>> => {
    const directory = await fileSystem.makeDirectory(root);
    if (directory.kind === "Failed") {
      return err(
        `The plugin data directory could not be created: ${directory.message}`,
      );
    }

    const written = await fileSystem.writeTextFile(
      path,
      `${JSON.stringify({ version: PREFERENCES_VERSION, ...stored }, undefined, 2)}\n`,
      PUBLIC_FILE_MODE,
    );

    if (written.kind === "Failed") {
      return err(`The preferences could not be saved: ${written.message}`);
    }

    cached = stored;
    return ok(stored);
  };

  return {
    getParameterNames: async (): Promise<Result<ParameterNames>> => {
      const stored = await readStored();
      return stored.kind === "Error" ? stored : ok(stored.value.parameterNames);
    },

    setParameterNames: async (
      input: ParameterNames,
    ): Promise<Result<ParameterNames>> => {
      const parsed = parameterNamesSchema.safeParse(input);
      if (!parsed.success) {
        return err(
          parsed.error.issues[0]?.message ?? "invalid parameter names",
        );
      }

      const stored = await readStored();
      if (stored.kind === "Error") return stored;

      const written = await writeStored({
        ...stored.value,
        parameterNames: parsed.data,
      });
      return written.kind === "Error" ? written : ok(parsed.data);
    },

    getHighlightSettings: async (): Promise<Result<HighlightSettings>> => {
      const stored = await readStored();
      return stored.kind === "Error" ? stored : ok(stored.value.highlight);
    },

    setHighlightSettings: async (
      input: HighlightSettings,
    ): Promise<Result<HighlightSettings>> => {
      const parsed = highlightSettingsSchema.safeParse(input);
      if (!parsed.success) {
        return err(
          parsed.error.issues[0]?.message ?? "invalid highlight settings",
        );
      }

      const stored = await readStored();
      if (stored.kind === "Error") return stored;

      const written = await writeStored({
        ...stored.value,
        highlight: parsed.data,
      });
      return written.kind === "Error" ? written : ok(parsed.data);
    },
  };
};
