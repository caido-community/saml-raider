import {
  DEFAULT_PARAMETER_NAMES,
  err,
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

const storedPreferencesSchema = z.object({
  version: z.literal(PREFERENCES_VERSION),
  parameterNames: parameterNamesSchema,
});

export const buildPreferencesApi = (fileSystem: FileSystem, root: string) => {
  const path = buildPath(root, PREFERENCES_FILE);

  return {
    getParameterNames: async (): Promise<Result<ParameterNames>> => {
      const outcome = await fileSystem.readTextFile(path);
      if (outcome.kind === "Missing") return ok(DEFAULT_PARAMETER_NAMES);
      if (outcome.kind === "Failed") {
        return err(
          `The stored parameter names could not be read: ${outcome.message}. They were left unchanged.`,
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
          "The stored parameter names could not be read: the file is not valid JSON. It was left unchanged.",
        );
      }

      const parsed = storedPreferencesSchema.safeParse(content);
      return parsed.success
        ? ok(parsed.data.parameterNames)
        : err(
            `The stored parameter names could not be read: ${parsed.error.issues[0]?.message ?? "unrecognised format"}. The file was left unchanged.`,
          );
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

      const directory = await fileSystem.makeDirectory(root);
      if (directory.kind === "Failed") {
        return err(
          `The plugin data directory could not be created: ${directory.message}`,
        );
      }

      const written = await fileSystem.writeTextFile(
        path,
        `${JSON.stringify({ version: PREFERENCES_VERSION, parameterNames: parsed.data }, undefined, 2)}\n`,
        PUBLIC_FILE_MODE,
      );

      return written.kind === "Failed"
        ? err(`The preferences could not be saved: ${written.message}`)
        : ok(parsed.data);
    },
  };
};
