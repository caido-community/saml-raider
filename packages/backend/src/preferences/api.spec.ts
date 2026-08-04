import { DEFAULT_PARAMETER_NAMES } from "shared";
import { describe, expect, it } from "vitest";

import { buildMemoryFileSystem } from "../tests/memoryFileSystem";

import { buildPreferencesApi } from "./api";

const ROOT = "/plugin";

const buildApi = () => {
  const fileSystem = buildMemoryFileSystem();
  return { api: buildPreferencesApi(fileSystem, ROOT), fileSystem };
};

describe("defaults", () => {
  it("uses the protocol names when nothing is stored", async () => {
    const { api } = buildApi();

    const result = await api.getParameterNames();

    expect(result).toEqual({ kind: "Ok", value: DEFAULT_PARAMETER_NAMES });
    expect(DEFAULT_PARAMETER_NAMES.samlRequest).toBe("SAMLRequest");
    expect(DEFAULT_PARAMETER_NAMES.samlResponse).toBe("SAMLResponse");
  });

  it("refuses a corrupt file rather than silently resetting detection", async () => {
    const { api, fileSystem } = buildApi();
    await fileSystem.writeTextFile(
      `${ROOT}/preferences.json`,
      "{ broken",
      0o600,
    );

    const result = await api.getParameterNames();

    expect(result.kind).toBe("Error");
    expect(result.kind === "Error" && result.error).toContain("not valid JSON");
  });

  it("refuses when the file is there but cannot be read", async () => {
    const { api, fileSystem } = buildApi();
    await fileSystem.writeTextFile(`${ROOT}/preferences.json`, "{}", 0o600);
    fileSystem.failing.add(`${ROOT}/preferences.json`);

    const result = await api.getParameterNames();

    expect(result.kind).toBe("Error");
  });

  it("refuses a version it does not understand", async () => {
    const { api, fileSystem } = buildApi();
    await fileSystem.writeTextFile(
      `${ROOT}/preferences.json`,
      JSON.stringify({
        version: 99,
        parameterNames: { samlRequest: "a", samlResponse: "b" },
      }),
      0o600,
    );

    const result = await api.getParameterNames();

    expect(result.kind).toBe("Error");
  });
});

describe("custom names", () => {
  it("stores and returns them", async () => {
    const { api } = buildApi();

    await api.setParameterNames({ samlRequest: "req", samlResponse: "resp" });
    const result = await api.getParameterNames();

    expect(result).toEqual({
      kind: "Ok",
      value: { samlRequest: "req", samlResponse: "resp" },
    });
  });

  it("trims surrounding whitespace", async () => {
    const { api } = buildApi();

    const result = await api.setParameterNames({
      samlRequest: "  req  ",
      samlResponse: "resp",
    });

    expect(result).toEqual({
      kind: "Ok",
      value: { samlRequest: "req", samlResponse: "resp" },
    });
  });

  it("keeps casing, because a query parameter is case sensitive", async () => {
    const { api } = buildApi();

    await api.setParameterNames({
      samlRequest: "samlrequest",
      samlResponse: "SAMLResponse",
    });
    const result = await api.getParameterNames();

    expect(result).toEqual({
      kind: "Ok",
      value: { samlRequest: "samlrequest", samlResponse: "SAMLResponse" },
    });
  });
});

describe("rejected input", () => {
  it("refuses two identical names", async () => {
    const { api } = buildApi();

    const result = await api.setParameterNames({
      samlRequest: "same",
      samlResponse: "same",
    });

    expect(result.kind).toBe("Error");
  });

  it("refuses a blank name", async () => {
    const { api } = buildApi();

    expect(
      (await api.setParameterNames({ samlRequest: "   ", samlResponse: "b" }))
        .kind,
    ).toBe("Error");
  });

  it("leaves the stored value alone when the new one is rejected", async () => {
    const { api } = buildApi();
    await api.setParameterNames({ samlRequest: "req", samlResponse: "resp" });

    await api.setParameterNames({ samlRequest: "x", samlResponse: "x" });
    const result = await api.getParameterNames();

    expect(result).toEqual({
      kind: "Ok",
      value: { samlRequest: "req", samlResponse: "resp" },
    });
  });
});

describe("the stored format", () => {
  it("writes a versioned record, so a later format can be migrated", async () => {
    const { api, fileSystem } = buildApi();

    await api.setParameterNames({ samlRequest: "req", samlResponse: "resp" });
    const written = fileSystem.files.get(`${ROOT}/preferences.json`)?.content;

    expect(JSON.parse(written ?? "{}")).toEqual({
      version: 1,
      parameterNames: { samlRequest: "req", samlResponse: "resp" },
    });
  });

  it("reads a hand-written record of the current version", async () => {
    const { api, fileSystem } = buildApi();
    await fileSystem.writeTextFile(
      `${ROOT}/preferences.json`,
      JSON.stringify({
        version: 1,
        parameterNames: { samlRequest: "a", samlResponse: "b" },
      }),
      0o600,
    );

    const result = await api.getParameterNames();

    expect(result).toEqual({
      kind: "Ok",
      value: { samlRequest: "a", samlResponse: "b" },
    });
  });

  it("does not rewrite a file it did not understand", async () => {
    const { api, fileSystem } = buildApi();
    const path = `${ROOT}/preferences.json`;
    await fileSystem.writeTextFile(path, '{"version":99}', 0o600);

    await api.getParameterNames();

    expect(fileSystem.files.get(path)?.content).toBe('{"version":99}');
  });

  it("refuses a stored record whose names collide", async () => {
    const { api, fileSystem } = buildApi();
    await fileSystem.writeTextFile(
      `${ROOT}/preferences.json`,
      JSON.stringify({
        version: 1,
        parameterNames: { samlRequest: "same", samlResponse: "same" },
      }),
      0o600,
    );

    const result = await api.getParameterNames();

    expect(result.kind).toBe("Error");
  });
});
