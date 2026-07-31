import {
  type RequestDraft,
  type RequestFull,
  type ResponseFull,
} from "@caido/sdk-frontend";
import { type EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";

import { describeSource, isWritableSource, readMessageSource } from "./source";

const draft = (raw: string) => ({ raw }) as RequestDraft;
const request = (raw: string) => ({ raw }) as RequestFull;
const response = (raw: string) => ({ raw }) as ResponseFull;
const editor = (readOnly: boolean) => ({ state: { readOnly } }) as EditorView;

describe("resolving the host surface", () => {
  it("treats a draft with an editable editor as writable", () => {
    const source = readMessageSource({
      draft: draft("d"),
      view: editor(false),
    });

    expect(source).toStrictEqual({ kind: "WritableRequest", raw: "d" });
    expect(isWritableSource(source)).toBe(true);
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
    expect(describeSource({ kind: "WritableRequest", raw: "" })).toBe(
      "request",
    );
    expect(describeSource({ kind: "ReadableRequest", raw: "" })).toBe(
      "request",
    );
  });
});
