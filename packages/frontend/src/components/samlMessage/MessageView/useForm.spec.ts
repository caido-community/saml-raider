// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";

import { type MessageSource } from "./source";
import { type MessageForm, useForm } from "./useForm";

import { buildEditorDouble } from "@/tests/editor";
import {
  buildRawRequest,
  FORM_CONTENT_TYPE,
  MINIMAL_RESPONSE,
} from "@/tests/fixtures";
import { encodeBase64, isAbsent } from "@/utils";

const postBinding = (xml: string): string => {
  const parameter = encodeURIComponent(
    encodeBase64(new TextEncoder().encode(xml)),
  );

  return buildRawRequest(
    "POST /acs HTTP/1.1",
    [FORM_CONTENT_TYPE],
    `SAMLResponse=${parameter}`,
  );
};

const NON_SAML = buildRawRequest("GET /index.html HTTP/1.1", ["Host: a"]);

const mountForm = (options: {
  request?: string;
  draft?: string;
  response?: string;
}) => {
  const raw = ref(options.draft ?? options.request ?? options.response ?? "");
  const kind: MessageSource["kind"] =
    options.draft !== undefined
      ? "WritableRequest"
      : options.response !== undefined
        ? "Response"
        : "ReadableRequest";

  const created: MessageForm[] = [];

  const Host = defineComponent({
    setup() {
      created.push(
        useForm(() =>
          kind === "WritableRequest"
            ? { kind, raw: raw.value, view: buildEditorDouble().view }
            : { kind, raw: raw.value },
        ),
      );
      return () => h("div");
    },
  });

  mount(Host);

  const form = created[0];
  if (isAbsent(form)) throw new Error("useForm did not run");

  return { form, setRaw: (next: string) => (raw.value = next) };
};

const waitForIssuer = (form: MessageForm, issuer: string) =>
  vi.waitFor(() => {
    const state = form.state.value;
    if (state.kind !== "Message") throw new Error(`still ${state.message}`);
    expect(state.info.issuer).toBe(issuer);
  });

const waitForNotice = (form: MessageForm, fragment: string) =>
  vi.waitFor(() => {
    const state = form.state.value;
    if (state.kind !== "Notice") throw new Error("expected a notice");
    expect(state.message).toContain(fragment);
  });

describe("initial load", () => {
  it("decodes a SAML request present at mount", async () => {
    const { form } = mountForm({ request: postBinding(MINIMAL_RESPONSE) });

    await waitForIssuer(form, "https://idp.example.com");
  });

  it("shows a specific notice for a non-SAML request", async () => {
    const { form } = mountForm({ request: NON_SAML });

    await waitForNotice(form, "No SAML message");
  });

  it("decodes SAML arriving in a response body", async () => {
    const { form } = mountForm({ response: postBinding(MINIMAL_RESPONSE) });

    await waitForIssuer(form, "https://idp.example.com");
  });
});

describe("source replacement while mounted", () => {
  it("reloads when the source is replaced by a different message", async () => {
    const first = MINIMAL_RESPONSE.replace("idp.example.com", "first.example");
    const second = MINIMAL_RESPONSE.replace(
      "idp.example.com",
      "second.example",
    );

    const { form, setRaw } = mountForm({ request: postBinding(first) });
    await waitForIssuer(form, "https://first.example");

    setRaw(postBinding(second));
    await waitForIssuer(form, "https://second.example");
  });

  it("does not keep stale content when the source stops being SAML", async () => {
    const { form, setRaw } = mountForm({
      request: postBinding(MINIMAL_RESPONSE),
    });
    await waitForIssuer(form, "https://idp.example.com");

    setRaw(NON_SAML);
    await waitForNotice(form, "No SAML message");
  });
});

describe("writability follows the host surface", () => {
  it("is writable when the host supplies a draft", () => {
    const { form } = mountForm({ draft: postBinding(MINIMAL_RESPONSE) });

    expect(form.isWritable.value).toBe(true);
  });

  it("is read-only for a persisted request", () => {
    const { form } = mountForm({ request: postBinding(MINIMAL_RESPONSE) });

    expect(form.isWritable.value).toBe(false);
  });

  it("is read-only for a response", () => {
    const { form } = mountForm({ response: postBinding(MINIMAL_RESPONSE) });

    expect(form.isWritable.value).toBe(false);
  });
});

describe("live draft edits", () => {
  it("re-decodes as the draft text changes", async () => {
    const first = MINIMAL_RESPONSE.replace("idp.example.com", "typed.one");
    const second = MINIMAL_RESPONSE.replace("idp.example.com", "typed.two");

    const { form, setRaw } = mountForm({ draft: postBinding(first) });
    await waitForIssuer(form, "https://typed.one");

    setRaw(postBinding(second));
    await waitForIssuer(form, "https://typed.two");
  });
});

describe("failures reach the view state", () => {
  it("names the reason for a malformed parameter", async () => {
    const { form } = mountForm({
      request: buildRawRequest(
        "POST /acs HTTP/1.1",
        [FORM_CONTENT_TYPE],
        "SAMLResponse=%",
      ),
    });

    await waitForNotice(form, "percent-encoding");
  });

  it("refuses a message that declares a doctype", async () => {
    const { form } = mountForm({
      request: postBinding(`<!DOCTYPE r><Response><Assertion/></Response>`),
    });

    await waitForNotice(form, "DOCTYPE");
  });
});

describe("choosing how the message is shown", () => {
  it("opens on the message itself rather than an inner panel", () => {
    const { form } = mountForm({ request: postBinding(MINIMAL_RESPONSE) });

    expect(form.panel.value).toBe("Message");
    expect(form.format.value).toBe("Raw");
  });

  it("shows the exact bytes by default and prettifies only on request", () => {
    const { form } = mountForm({ request: postBinding(MINIMAL_RESPONSE) });
    const state = form.state.value;
    if (state.kind !== "Message") throw new Error("did not decode");

    expect(form.messageText.value).toBe(state.xml);

    form.format.value = "Pretty";

    expect(form.messageText.value).toBe(state.prettyXml);
    expect(form.messageText.value).not.toBe(state.xml);
  });

  it("shows nothing when there is no message to format", () => {
    const { form } = mountForm({ request: NON_SAML });

    expect(form.state.value.kind).toBe("Notice");
    expect(form.messageText.value).toBe("");
  });
});
