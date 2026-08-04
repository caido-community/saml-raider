import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildFileSystem, SECRET_FILE_MODE } from "./fileSystem";

const fileSystem = buildFileSystem();
let root = "";

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "saml-raider-fs-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("telling a missing file from an unreadable one", () => {
  it("reports a path that was never written as missing", async () => {
    const outcome = await fileSystem.readTextFile(join(root, "absent.json"));

    expect(outcome).toEqual({ kind: "Missing" });
  });

  it("reads back what was written", async () => {
    const path = join(root, "store.json");
    await fileSystem.writeTextFile(path, "{}", SECRET_FILE_MODE);

    expect(await fileSystem.readTextFile(path)).toEqual({
      kind: "Found",
      content: "{}",
    });
  });

  it("reports a path that exists but cannot be read as failed", async () => {
    const path = join(root, "store.json");
    await mkdir(path);

    const outcome = await fileSystem.readTextFile(path);

    expect(outcome.kind).toBe("Failed");
  });
});

describe("listing a directory", () => {
  it("reports an absent directory as empty rather than as a failure", async () => {
    const outcome = await fileSystem.listFileNames(join(root, "keys"));

    expect(outcome).toEqual({ kind: "Listed", names: [] });
  });

  it("lists what is there", async () => {
    const keys = join(root, "keys");
    await fileSystem.makeDirectory(keys);
    await fileSystem.writeTextFile(join(keys, "a.pem"), "x", SECRET_FILE_MODE);

    const outcome = await fileSystem.listFileNames(keys);

    expect(outcome).toEqual({ kind: "Listed", names: ["a.pem"] });
  });

  it("reports a file standing where a directory is expected as failed", async () => {
    const path = join(root, "keys");
    await writeFile(path, "not a directory");

    expect((await fileSystem.listFileNames(path)).kind).toBe("Failed");
  });
});

describe("removing", () => {
  it("treats deleting something already gone as done", async () => {
    const outcome = await fileSystem.removeFile(join(root, "absent.pem"));

    expect(outcome).toEqual({ kind: "Written" });
  });

  it("deletes a file that is there", async () => {
    const path = join(root, "key.pem");
    await fileSystem.writeTextFile(path, "x", SECRET_FILE_MODE);

    await fileSystem.removeFile(path);

    expect(await fileSystem.readTextFile(path)).toEqual({ kind: "Missing" });
  });
});

describe("writing", () => {
  it("leaves no staging file behind", async () => {
    await fileSystem.writeTextFile(
      join(root, "store.json"),
      "{}",
      SECRET_FILE_MODE,
    );

    const outcome = await fileSystem.listFileNames(root);

    expect(outcome).toEqual({ kind: "Listed", names: ["store.json"] });
  });

  it("replaces the previous content rather than appending", async () => {
    const path = join(root, "store.json");
    await fileSystem.writeTextFile(path, "first", SECRET_FILE_MODE);

    await fileSystem.writeTextFile(path, "second", SECRET_FILE_MODE);

    expect(await readFile(path, "utf8")).toBe("second");
  });

  it.runIf(process.platform !== "win32")(
    "creates a secret file that only its owner can read",
    async () => {
      const path = join(root, "key.pem");

      await fileSystem.writeTextFile(path, "x", SECRET_FILE_MODE);

      expect((await stat(path)).mode & 0o777).toBe(SECRET_FILE_MODE);
    },
  );

  it("reports a write it cannot perform instead of claiming success", async () => {
    const path = join(root, "missing-parent", "store.json");

    const outcome = await fileSystem.writeTextFile(
      path,
      "{}",
      SECRET_FILE_MODE,
    );

    expect(outcome.kind).toBe("Failed");
  });
});
