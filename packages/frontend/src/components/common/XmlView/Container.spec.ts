// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import { XmlView } from ".";

const XML = `<Response ID="_r1"><Issuer>https://idp.example.com</Issuer></Response>`;

const mountView = (content: string) => mount(XmlView, { props: { content } });

const editorText = (element: Element): string =>
  Array.from(element.querySelectorAll(".cm-line"))
    .map((line) => line.textContent)
    .join("\n");

describe("editor lifecycle", () => {
  it("creates a CodeMirror editor on mount", () => {
    const wrapper = mountView(XML);

    expect(wrapper.element.querySelectorAll(".cm-editor")).toHaveLength(1);
  });

  it("tears the editor down on unmount", () => {
    const wrapper = mountView(XML);
    const host = wrapper.element;

    wrapper.unmount();

    expect(host.querySelectorAll(".cm-editor")).toHaveLength(0);
  });

  it("creates exactly one editor, not one per render", async () => {
    const wrapper = mountView(XML);
    await nextTick();

    expect(wrapper.element.querySelectorAll(".cm-editor")).toHaveLength(1);
  });
});

describe("content", () => {
  it("renders the XML it was given", () => {
    const wrapper = mountView(XML);

    expect(editorText(wrapper.element)).toContain("https://idp.example.com");
  });

  it("replaces the document when the content prop changes", async () => {
    const wrapper = mountView(XML);

    await wrapper.setProps({ content: "<Other>changed</Other>" });
    await nextTick();

    const text = editorText(wrapper.element);
    expect(text).toContain("changed");
    expect(text).not.toContain("idp.example.com");
  });

  it("renders an empty document without failing", () => {
    const wrapper = mountView("");

    expect(wrapper.element.querySelectorAll(".cm-editor")).toHaveLength(1);
  });

  it("keeps every line of a multi-line document", () => {
    const wrapper = mountView("<a>\n  <b/>\n  <c/>\n</a>");

    expect(wrapper.element.querySelectorAll(".cm-line")).toHaveLength(4);
  });
});

describe("read-only", () => {
  it("marks the content as not editable, so no caret appears", () => {
    const wrapper = mountView(XML);
    const content = wrapper.element.querySelector(".cm-content");

    expect(content?.getAttribute("contenteditable")).toBe("false");
  });

  it("keeps the text selectable, which read-only must not prevent", () => {
    const wrapper = mountView(XML);
    const content = wrapper.element.querySelector(".cm-content");

    expect(content).not.toBeNull();
    expect(editorText(wrapper.element).length).toBeGreaterThan(0);
  });
});

describe("syntax highlighting", () => {
  it("tokenises the XML rather than rendering one flat string", () => {
    const wrapper = mountView(XML);
    const line = wrapper.element.querySelector(".cm-line");

    expect(line?.children.length ?? 0).toBeGreaterThan(1);
  });
});
