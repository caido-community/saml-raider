// @vitest-environment happy-dom
import { err, type HighlightSettings, ok } from "shared";
import { describe, expect, it } from "vitest";

import { useForm } from "./useForm";

import { type PreferenceService } from "@/services/preferences";
import { mountComposable } from "@/tests/mountComposable";
import { type NotificationSink } from "@/types";

const build = async (failWith?: string) => {
  const saved: HighlightSettings[] = [];
  let stored: HighlightSettings = { isEnabled: true, color: "purple" };
  const errors: string[] = [];

  const service = {
    getParameterNames: () => Promise.resolve(ok({} as never)),
    setParameterNames: () => Promise.resolve(ok({} as never)),
    getHighlightSettings: () => Promise.resolve(ok(stored)),
    setHighlightSettings: (input: HighlightSettings) => {
      if (failWith !== undefined) return Promise.resolve(err(failWith));
      saved.push(input);
      stored = input;
      return Promise.resolve(ok(input));
    },
  } as PreferenceService;

  const notifications: NotificationSink = {
    showSuccess: () => undefined,
    showError: (message: string) => errors.push(message),
  };

  const form = await mountComposable(() => useForm({ service, notifications }));
  return { form, saved, errors };
};

describe("turning highlighting on and off", () => {
  it("starts from what was stored, not from its own defaults", async () => {
    const { form } = await build();

    await form.load();

    expect(form.isEnabled.value).toBe(true);
    expect(form.color.value).toBe("purple");
  });

  it("saves as soon as the switch is flipped, with no save button", async () => {
    const { form, saved } = await build();
    await form.load();

    await form.setEnabled(false);

    expect(saved).toStrictEqual([{ isEnabled: false, color: "purple" }]);
    expect(form.isEnabled.value).toBe(false);
  });

  it("saves as soon as a colour is picked", async () => {
    const { form, saved } = await build();
    await form.load();

    await form.setColor("green");

    expect(saved).toStrictEqual([{ isEnabled: true, color: "green" }]);
    expect(form.color.value).toBe("green");
  });

  it("keeps the colour when the switch is flipped", async () => {
    const { form, saved } = await build();
    await form.load();

    await form.setColor("red");
    await form.setEnabled(false);

    expect(saved[1]).toStrictEqual({ isEnabled: false, color: "red" });
  });

  it("reports a failed save rather than pretending it stuck", async () => {
    const { form, errors } = await build("the preferences are read only");
    await form.load();

    await form.setEnabled(false);

    expect(errors).toStrictEqual(["the preferences are read only"]);
  });

  it("puts the switch back when the save fails, so it never lies", async () => {
    const { form } = await build("the preferences are read only");
    await form.load();

    await form.setEnabled(false);

    expect(form.isEnabled.value).toBe(true);
  });

  it("puts the colour back when the save fails", async () => {
    const { form } = await build("the preferences are read only");
    await form.load();

    await form.setColor("red");

    expect(form.color.value).toBe("purple");
  });
});
