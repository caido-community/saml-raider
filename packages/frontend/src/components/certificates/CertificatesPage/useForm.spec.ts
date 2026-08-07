// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { useForm } from "./useForm";

import {
  buildCertificate,
  buildServiceDouble,
} from "@/tests/certificateService";
import { mountComposable } from "@/tests/mountComposable";

const buildNotifications = () => {
  const errors: string[] = [];
  const successes: string[] = [];

  return {
    errors,
    successes,
    notifications: {
      showSuccess: (message: string) => successes.push(message),
      showError: (message: string) => errors.push(message),
    },
  };
};

const buildPage = async (
  certificates = [buildCertificate("a")],
  failWith?: string,
) => {
  const { service, calls } = buildServiceDouble(certificates, failWith);
  const { notifications, errors, successes } = buildNotifications();
  const form = await mountComposable(() => useForm({ service, notifications }));

  return { form, calls, errors, successes };
};

describe("loading", () => {
  it("lists what the backend returned once mounted", async () => {
    const { form } = await buildPage([
      buildCertificate("a"),
      buildCertificate("b"),
    ]);

    expect(form.page.value.kind).toBe("Ready");
    expect(form.certificates.value).toHaveLength(2);
  });

  it("shows a failure state rather than an empty list when loading fails", async () => {
    const { form, errors } = await buildPage([], "the store is unreadable");

    expect(form.page.value).toEqual({
      kind: "Failed",
      message: "the store is unreadable",
    });
    expect(errors[0]).toContain("the store is unreadable");
  });

  it("invites an import when the store is genuinely empty", async () => {
    const { form } = await buildPage([]);

    expect(form.detailPlaceholder.value.title).toBe("No certificates");
  });

  it("asks the user to pick one when certificates exist", async () => {
    const { form } = await buildPage();

    expect(form.detailPlaceholder.value.title).toBe("No certificate selected");
  });
});

describe("selection", () => {
  it("exposes the selected certificate", async () => {
    const { form } = await buildPage([
      buildCertificate("a"),
      buildCertificate("b"),
    ]);

    form.select("b");

    expect(form.selected.value?.id).toBe("b");
  });

  it("clears a selection that is no longer listed after a refresh", async () => {
    const { form } = await buildPage([buildCertificate("a")]);
    form.select("a");

    form.selectedId.value = "gone";
    await form.refresh();

    expect(form.selectedId.value).toBeUndefined();
  });
});

describe("mutations", () => {
  it("renames the selected certificate and reports it", async () => {
    const { form, calls, successes } = await buildPage();
    form.select("a");

    await form.renameSelected("renamed");

    expect(calls.renamed).toEqual([{ id: "a", label: "renamed" }]);
    expect(successes.some((message) => message.includes("renamed"))).toBe(true);
  });

  it("drops the selection after the certificate is deleted", async () => {
    const { form, calls } = await buildPage();
    form.select("a");

    await form.removeSelected();

    expect(calls.removed).toEqual(["a"]);
    expect(form.selectedId.value).toBeUndefined();
  });

  it("does nothing when no certificate is selected", async () => {
    const { form, calls } = await buildPage();

    await form.removeSelected();
    await form.renameSelected("x");

    expect(calls.removed).toEqual([]);
    expect(calls.renamed).toEqual([]);
  });

  it("reports a failed mutation instead of claiming success", async () => {
    const { form, errors, successes } = await buildPage(
      [buildCertificate("a")],
      "disk is full",
    );
    form.select("a");

    await form.removeSelected();

    expect(errors.some((message) => message.includes("disk is full"))).toBe(
      true,
    );
    expect(successes).toEqual([]);
  });
});

describe("private keys", () => {
  it("reads the key only when one is explicitly exported", async () => {
    const { form, calls } = await buildPage();
    form.select("a");

    await form.exportSelectedCertificate();
    expect(calls.readPrivateKeyPem).toEqual([]);

    await form.exportSelectedPrivateKey();
    expect(calls.readPrivateKeyPem).toEqual(["a"]);
  });
});

describe("filtering", () => {
  it("normalises an absent filter value to an empty string", async () => {
    const { form } = await buildPage();

    form.applyFilter(undefined);

    expect(form.filter.value).toBe("");
  });

  it("clears the filter", async () => {
    const { form } = await buildPage();
    form.applyFilter("abc");

    form.clearFilter();

    expect(form.filter.value).toBe("");
  });
});
