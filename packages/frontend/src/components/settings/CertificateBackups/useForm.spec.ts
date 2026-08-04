// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { useForm } from "./useForm";

import {
  buildCertificate,
  buildServiceDouble,
} from "@/tests/certificateService";

const build = (failWith?: string) => {
  const { service } = buildServiceDouble([buildCertificate("a")], failWith);
  const errors: string[] = [];
  const successes: string[] = [];

  const form = useForm({
    service,
    notifications: {
      showSuccess: (message: string) => successes.push(message),
      showError: (message: string) => errors.push(message),
    },
  });

  return { form, errors, successes };
};

describe("exporting", () => {
  it("closes the dialog and reports success", async () => {
    const { form, successes } = build();
    form.openExport();

    await form.exportBackup(false);

    expect(form.isExportOpen.value).toBe(false);
    expect(successes).toEqual(["Certificate backup exported."]);
    expect(form.error.value).toBeUndefined();
  });

  it("keeps the dialog open and holds the reason when the export fails", async () => {
    const { form, errors, successes } = build("the store is unreadable");
    form.openExport();

    await form.exportBackup(true);

    expect(form.isExportOpen.value).toBe(true);
    expect(form.error.value).toBe("the store is unreadable");
    expect(errors[0]).toContain("the store is unreadable");
    expect(successes).toEqual([]);
  });

  it("clears a stale error when the dialog is reopened", async () => {
    const { form } = build("the store is unreadable");
    form.openExport();
    await form.exportBackup(true);

    form.openExport();

    expect(form.error.value).toBeUndefined();
  });
});

describe("guarding concurrent work", () => {
  it("reports busy only while an operation is running", async () => {
    const { form } = build();

    expect(form.isBusy.value).toBe(false);

    const running = form.exportBackup(false);
    expect(form.isExporting.value).toBe(true);
    expect(form.isBusy.value).toBe(true);

    await running;
    expect(form.isBusy.value).toBe(false);
    expect(form.isExporting.value).toBe(false);
  });

  it("ignores a second export while the first is still running", async () => {
    const { form, successes } = build();

    await Promise.all([form.exportBackup(false), form.exportBackup(false)]);

    expect(successes).toHaveLength(1);
  });
});
