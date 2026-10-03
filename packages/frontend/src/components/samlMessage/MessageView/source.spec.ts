import {
  type RequestDraft,
  type RequestFull,
  type ResponseFull,
} from "@caido/sdk-frontend";
import { describe, expect, it } from "vitest";

import {
  applyRawToEditor,
  describeSource,
  isWritableSource,
  readMessageSource,
} from "./source";

import { buildEditorDouble } from "@/tests/editor";

const draft = (raw: string) => ({ raw }) as RequestDraft;
const request = (raw: string) => ({ raw }) as RequestFull;
const response = (raw: string) => ({ raw }) as ResponseFull;
const editor = (readOnly: boolean) => buildEditorDouble({ readOnly }).view;

describe("resolving the host surface", () => {
  it("treats a draft with an editable editor as writable", () => {
    const view = editor(false);
    const source = readMessageSource({ draft: draft("d"), view });

    expect(source).toStrictEqual({ kind: "WritableRequest", raw: "d", view });
    expect(isWritableSource(source)).toBe(true);
  });

  it("treats a draft with no editor as read-only rather than assuming a write channel", () => {
    const source = readMessageSource({ draft: draft("d") });

    expect(source).toStrictEqual({ kind: "ReadableRequest", raw: "d" });
    expect(isWritableSource(source)).toBe(false);
  });

  it("treats a draft whose editor is not editable as read-only", () => {
    const source = readMessageSource({
      draft: draft("d"),
      view: buildEditorDouble({ editable: false }).view,
    });

    expect(isWritableSource(source)).toBe(false);
  });

  it("treats a draft as read-only when the editor says so", () => {
    const source = readMessageSource({ draft: draft("d"), view: editor(true) });

    expect(source).toStrictEqual({ kind: "ReadableRequest", raw: "d" });
    expect(isWritableSource(source)).toBe(false);
  });

  it("prefers the live draft over the persisted request", () => {
    const source = readMessageSource({
      draft: draft("live"),
      request: request("saved"),
    });

    expect(source.kind !== "Absent" && source.raw).toBe("live");
  });

  it("resolves a persisted request as read-only", () => {
    expect(readMessageSource({ request: request("r") })).toStrictEqual({
      kind: "ReadableRequest",
      raw: "r",
    });
  });

  it("resolves a response as read-only", () => {
    const source = readMessageSource({ response: response("x") });

    expect(source).toStrictEqual({ kind: "Response", raw: "x" });
    expect(isWritableSource(source)).toBe(false);
  });

  it("resolves nothing when the host supplies no surface", () => {
    expect(readMessageSource({})).toStrictEqual({ kind: "Absent" });
  });
});

describe("describing the surface for user-facing copy", () => {
  it("calls a response a response", () => {
    expect(describeSource({ kind: "Response", raw: "" })).toBe("response");
  });

  it("calls both request surfaces a request", () => {
    expect(
      describeSource({ kind: "WritableRequest", raw: "", view: editor(false) }),
    ).toBe("request");
    expect(describeSource({ kind: "ReadableRequest", raw: "" })).toBe(
      "request",
    );
  });
});

describe("writing back into the host editor", () => {
  it("writes the replacement when nothing moved underneath it", () => {
    const editor = buildEditorDouble({ text: "before" });

    expect(applyRawToEditor(editor.view, "before", "after")).toStrictEqual({
      kind: "Written",
    });
    expect(editor.text()).toBe("after");
  });

  it("refuses a read-only editor even though CodeMirror would accept it", () => {
    const editor = buildEditorDouble({ text: "before", readOnly: true });

    expect(applyRawToEditor(editor.view, "before", "after")).toStrictEqual({
      kind: "Refused",
      reason: "ReadOnly",
    });
    expect(editor.dispatched).toStrictEqual([]);
    expect(editor.text()).toBe("before");
  });

  it("refuses an editor the host marked as not editable", () => {
    const editor = buildEditorDouble({ text: "before", editable: false });

    expect(applyRawToEditor(editor.view, "before", "after")).toStrictEqual({
      kind: "Refused",
      reason: "ReadOnly",
    });
    expect(editor.dispatched).toStrictEqual([]);
  });

  it("refuses when the document changed while the work was in flight", () => {
    const editor = buildEditorDouble({ text: "edited by the user" });

    expect(applyRawToEditor(editor.view, "before", "after")).toStrictEqual({
      kind: "Refused",
      reason: "Diverged",
    });
    expect(editor.dispatched).toStrictEqual([]);
  });

  it("refuses to dispatch a change that would change nothing", () => {
    const editor = buildEditorDouble({ text: "same" });

    expect(applyRawToEditor(editor.view, "same", "same")).toStrictEqual({
      kind: "Refused",
      reason: "Unchanged",
    });
    expect(editor.dispatched).toStrictEqual([]);
  });

  it("compares against the editor document, not the draft's line endings", () => {
    const editor = buildEditorDouble({ text: "GET / HTTP/1.1\nHost: a\n" });

    expect(
      applyRawToEditor(
        editor.view,
        "GET / HTTP/1.1\r\nHost: a\r\n",
        "GET / HTTP/1.1\nHost: b\n",
      ),
    ).toStrictEqual({ kind: "Refused", reason: "Diverged" });
  });
});
