// @vitest-environment happy-dom
import { err, ok, type ParameterNames } from "shared";
import { describe, expect, it } from "vitest";

import { useForm } from "./useForm";

import { type PreferenceService } from "@/services/preferences";
import { mountComposable } from "@/tests/mountComposable";
import { type NotificationSink } from "@/types";

const STORED: ParameterNames = {
  samlRequest: "SAMLRequest",
  samlResponse: "SAMLResponse",
};

const buildPreferenceDouble = (
  failWith?: string,
  initial: ParameterNames = STORED,
  loadFailure?: string,
) => {
  const writes: ParameterNames[] = [];
  let stored: ParameterNames = { ...initial };

  const service: PreferenceService = {
    getParameterNames: () =>
      Promise.resolve(
        loadFailure === undefined
          ? ok(stored)
          : err<ParameterNames>(loadFailure),
      ),
    setParameterNames: (input) => {
      writes.push(input);
      if (failWith !== undefined) {
        return Promise.resolve(err<ParameterNames>(failWith));
      }

      stored = input;
      return Promise.resolve(ok(input));
    },
  };

  return { service, writes };
};

const buildNotificationDouble = () => {
  const errors: string[] = [];
  const notifications: NotificationSink = {
    showSuccess: () => undefined,
    showError: (message) => errors.push(message),
  };

  return { notifications, errors };
};

const mountForm = (service: PreferenceService, sink: NotificationSink) =>
  mountComposable(() => useForm({ service, notifications: sink }));

const blurWith = (value: string): Event => {
  const input = document.createElement("input");
  input.value = value;
  const event = new Event("blur");
  input.dispatchEvent(event);
  return event;
};

describe("saving parameter names as the field is left", () => {
  it("writes the typed name once the field loses focus", async () => {
    const { service, writes } = buildPreferenceDouble();
    const { notifications } = buildNotificationDouble();
    const form = await mountForm(service, notifications);

    await form.saveRequest(blurWith("AuthnRequest"));

    expect(writes).toEqual([
      { samlRequest: "AuthnRequest", samlResponse: "SAMLResponse" },
    ]);
    expect(form.names.value.samlRequest).toBe("AuthnRequest");
  });

  it("does not write when the field was left untouched", async () => {
    const { service, writes } = buildPreferenceDouble();
    const { notifications } = buildNotificationDouble();
    const form = await mountForm(service, notifications);

    await form.saveRequest(blurWith("SAMLRequest"));

    expect(writes).toEqual([]);
  });

  it("puts the stored name back when the backend rejects the change", async () => {
    const { service } = buildPreferenceDouble("empty names are not allowed");
    const { notifications, errors } = buildNotificationDouble();
    const form = await mountForm(service, notifications);

    await form.saveResponse(blurWith(""));

    expect(form.names.value.samlResponse).toBe("SAMLResponse");
    expect(errors).toEqual([
      "Unable to save SAML parameter names: empty names are not allowed",
    ]);
  });
});

describe("restoring the defaults", () => {
  it("writes the defaults back and clears the customized flag", async () => {
    const { service, writes } = buildPreferenceDouble(undefined, {
      samlRequest: "AuthnRequest",
      samlResponse: "Assertion",
    });
    const { notifications } = buildNotificationDouble();
    const form = await mountForm(service, notifications);

    expect(form.isDefault.value).toBe(false);

    await form.restoreDefaults();

    expect(writes).toEqual([STORED]);
    expect(form.isDefault.value).toBe(true);
  });

  it("does not write when the names are already the defaults", async () => {
    const { service, writes } = buildPreferenceDouble();
    const { notifications } = buildNotificationDouble();
    const form = await mountForm(service, notifications);

    await form.restoreDefaults();

    expect(writes).toEqual([]);
  });
});

describe("when the stored names cannot be read", () => {
  it("surfaces the reason instead of showing the defaults as if they were saved", async () => {
    const { service } = buildPreferenceDouble(
      undefined,
      STORED,
      "the preferences file is unreadable",
    );
    const { notifications } = buildNotificationDouble();
    const form = await mountForm(service, notifications);

    expect(form.loadState.value).toEqual({
      kind: "Failed",
      message: "the preferences file is unreadable",
    });
  });

  it("refuses to save while the load is unresolved", async () => {
    const { service, writes } = buildPreferenceDouble(
      undefined,
      STORED,
      "the preferences file is unreadable",
    );
    const { notifications } = buildNotificationDouble();
    const form = await mountForm(service, notifications);

    await form.saveRequest(blurWith("AuthnRequest"));

    expect(writes).toEqual([]);
  });
});

describe("overlapping edits", () => {
  it("applies both edits when two fields are blurred at once", async () => {
    const { service, writes } = buildPreferenceDouble();
    const { notifications } = buildNotificationDouble();
    const form = await mountForm(service, notifications);

    await Promise.all([
      form.saveRequest(blurWith("AuthnRequest")),
      form.saveResponse(blurWith("Assertion")),
    ]);

    expect(writes).toHaveLength(2);
    expect(form.names.value).toEqual({
      samlRequest: "AuthnRequest",
      samlResponse: "Assertion",
    });
  });
});
