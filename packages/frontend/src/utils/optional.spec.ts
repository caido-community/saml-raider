import { describe, expect, it } from "vitest";

import { isAbsent, isPresent, type Maybe } from "./optional";

describe("isPresent", () => {
  it("rejects undefined", () => {
    expect(isPresent(undefined)).toBe(false);
  });

  it("accepts values that are falsy but present", () => {
    expect(isPresent("")).toBe(true);
    expect(isPresent(0)).toBe(true);
    expect(isPresent(false)).toBe(true);
    expect(isPresent(Number.NaN)).toBe(true);
  });

  it("accepts ordinary values", () => {
    expect(isPresent("SAMLResponse")).toBe(true);
    expect(isPresent({})).toBe(true);
  });

  it("narrows the type so the value is usable without a further check", () => {
    const relayState: Maybe<string> = "/dashboard";

    expect(isPresent(relayState) ? relayState.toUpperCase() : "absent").toBe(
      "/DASHBOARD",
    );
  });
});

describe("isAbsent", () => {
  it("accepts undefined", () => {
    expect(isAbsent(undefined)).toBe(true);
  });

  it("rejects values that are falsy but present", () => {
    expect(isAbsent("")).toBe(false);
    expect(isAbsent(0)).toBe(false);
    expect(isAbsent(false)).toBe(false);
  });
});

describe("absent is not the same as empty", () => {
  const relayStateOf = (parameters: Map<string, string>): Maybe<string> => {
    return parameters.get("RelayState");
  };

  it("distinguishes a RelayState that is missing from one that is empty", () => {
    const missing = relayStateOf(new Map());
    const empty = relayStateOf(new Map([["RelayState", ""]]));

    expect(isAbsent(missing)).toBe(true);
    expect(isAbsent(empty)).toBe(false);
    expect(isPresent(empty)).toBe(true);
  });
});
