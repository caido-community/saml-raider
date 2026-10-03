// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { ref } from "vue";

import { type InfoGroup, useForm } from "./useForm";

import { type Compression } from "@/core";
import { buildMessageInfo, SAML_RESPONSE } from "@/tests/fixtures";

const build = (xml: string, compression: Compression = "None") => {
  const form = useForm(
    () => buildMessageInfo(xml),
    () => compression,
  );

  return form.rows.value.flatMap((row) => row.groups);
};

const fieldValue = (groups: InfoGroup[], label: string): string => {
  const field = groups
    .flatMap((group) => group.fields)
    .find((candidate) => candidate.label === label);

  if (field === undefined) throw new Error(`no field labelled ${label}`);
  return field.value;
};

describe("group structure", () => {
  it("exposes the five titled groups", () => {
    const titles = build(SAML_RESPONSE).map((group) => group.title);

    expect(titles).toStrictEqual([
      "Assertion Information",
      "Signature Information",
      "Subject Information",
      "Encryption Information",
      "Message Information",
    ]);
  });

  it("gives every field a non-empty rendered value", () => {
    const values = build(SAML_RESPONSE)
      .flatMap((group) => group.fields)
      .map((field) => field.value);

    expect(values.every((value) => value.length > 0)).toBe(true);
  });
});

describe("empty values", () => {
  it("renders a placeholder rather than an empty cell", () => {
    const groups = build("<Response/>");

    expect(fieldValue(groups, "Issuer")).toBe("—");
    expect(fieldValue(groups, "Subject")).toBe("—");
    expect(fieldValue(groups, "Destination")).toBe("—");
  });

  it("distinguishes an absent value from a zero count", () => {
    const groups = build("<Response/>");

    expect(fieldValue(groups, "Assertions")).toBe("0");
    expect(fieldValue(groups, "Encrypted Assertions")).toBe("0");
  });

  it("treats an empty string as absent", () => {
    const groups = build("<Response><Issuer></Issuer></Response>");

    expect(fieldValue(groups, "Issuer")).toBe("—");
  });
});

describe("multiple values", () => {
  it("joins several signed elements into one readable field", () => {
    const xml = `<Response ID="_r1"><Signature/><Assertion ID="_a1"><Signature/></Assertion></Response>`;

    expect(fieldValue(build(xml), "Signed Elements")).toBe(
      "Response (_r1), Assertion (_a1)",
    );
  });

  it("counts several assertions", () => {
    const xml = `<Response><Assertion ID="_a1"/><Assertion ID="_a2"/></Response>`;

    expect(fieldValue(build(xml), "Assertions")).toBe("2");
  });
});

describe("long values", () => {
  it("renders a long issuer unchanged, leaving wrapping to the view", () => {
    const long = `https://idp.example.com/${"segment/".repeat(60)}`;
    const xml = `<Response><Issuer>${long}</Issuer></Response>`;

    expect(fieldValue(build(xml), "Issuer")).toBe(long);
  });
});

describe("unknown and flagged fields", () => {
  it("reports Unknown for a message type it does not recognise", () => {
    expect(fieldValue(build("<html/>"), "Message Type")).toBe("Unknown");
  });

  it("renders the duplicate-ID flag as a word, not a boolean", () => {
    const clean = build(`<Response><Assertion ID="_a1"/></Response>`);
    const duplicated = build(
      `<Response><Assertion ID="_x"/><Assertion ID="_x"/></Response>`,
    );

    expect(fieldValue(clean, "Duplicate IDs")).toBe("No");
    expect(fieldValue(duplicated, "Duplicate IDs")).toBe("Yes");
  });

  it("shows the transport compression it was given", () => {
    expect(fieldValue(build("<Response/>", "Deflate"), "Compression")).toBe(
      "Deflate",
    );
  });
});

describe("reactivity", () => {
  it("recomputes when the compression source changes", () => {
    const compression = ref<Compression>("None");
    const form = useForm(
      () => buildMessageInfo("<Response/>"),
      () => compression.value,
    );

    const groups = () => form.rows.value.flatMap((row) => row.groups);

    expect(fieldValue(groups(), "Compression")).toBe("None");

    compression.value = "Gzip";

    expect(fieldValue(groups(), "Compression")).toBe("Gzip");
  });
});

describe("row layout", () => {
  const rowsFor = (xml: string) =>
    useForm(
      () => buildMessageInfo(xml),
      () => "None",
    ).rows.value;

  it("pairs only the two groups whose content is always short", () => {
    const paired = rowsFor(SAML_RESPONSE)
      .filter((row) => row.groups.length === 2)
      .map((row) => row.groups.map((group) => group.title));

    expect(paired).toStrictEqual([
      ["Subject Information", "Encryption Information"],
    ]);
  });

  it("gives Message Information a row of its own, because it is not short", () => {
    const message = rowsFor(SAML_RESPONSE).find((row) =>
      row.groups.some((group) => group.title === "Message Information"),
    );

    expect(message?.groups).toHaveLength(1);
  });

  it("keeps every group in exactly one row, in order", () => {
    const titles = rowsFor(SAML_RESPONSE).flatMap((row) =>
      row.groups.map((group) => group.title),
    );

    expect(titles).toStrictEqual([
      "Assertion Information",
      "Signature Information",
      "Subject Information",
      "Encryption Information",
      "Message Information",
    ]);
  });
});
