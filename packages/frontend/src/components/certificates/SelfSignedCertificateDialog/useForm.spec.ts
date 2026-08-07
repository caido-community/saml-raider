import { describe, expect, it } from "vitest";

import { useForm } from "./useForm";

const valid = () => {
  const form = useForm();
  form.fields.value.label = "signing";
  form.fields.value.commonName = "idp.example.com";
  return form;
};

describe("required fields", () => {
  it("starts invalid so an empty dialog cannot be submitted", () => {
    const form = useForm();

    expect(form.isValid.value).toBe(false);
    expect(form.fieldErrors.value.label).toBe("A name is required.");
    expect(form.fieldErrors.value.commonName).toBe(
      "A common name is required.",
    );
  });

  it("becomes valid once a name and common name are given", () => {
    expect(valid().isValid.value).toBe(true);
  });

  it("treats whitespace as absent", () => {
    const form = useForm();
    form.fields.value.label = "   ";
    form.fields.value.commonName = "   ";

    expect(form.fieldErrors.value.label).toBe("A name is required.");
    expect(form.isValid.value).toBe(false);
  });
});

describe("length and format limits", () => {
  it("rejects a name over 200 characters", () => {
    const form = valid();
    form.fields.value.label = "x".repeat(201);

    expect(form.fieldErrors.value.label).toContain("200");
    expect(form.isValid.value).toBe(false);
  });

  it("rejects a common name over 64 characters", () => {
    const form = valid();
    form.fields.value.commonName = "x".repeat(65);

    expect(form.fieldErrors.value.commonName).toContain("64");
  });

  it("accepts an empty country but rejects one that is not two letters", () => {
    const form = valid();

    expect(form.fieldErrors.value.country).toBeUndefined();

    form.fields.value.country = "CHE";
    expect(form.fieldErrors.value.country).toContain("two-letter");

    form.fields.value.country = "CH";
    expect(form.fieldErrors.value.country).toBeUndefined();
  });

  it("rejects an end date that is not after the start", () => {
    const form = valid();
    const day = new Date("2026-06-01T00:00:00.000Z");
    form.fields.value.notBefore = day;
    form.fields.value.notAfter = day;

    expect(form.fieldErrors.value.notAfter).toContain("later than the first");
  });

  it("rejects a missing date", () => {
    const form = valid();
    form.fields.value.notAfter = undefined;

    expect(form.fieldErrors.value.notAfter).toBe("Choose the last valid date.");
    expect(form.isValid.value).toBe(false);
  });
});

describe("tracking unsaved edits", () => {
  it("is clean when untouched and dirty after a change", () => {
    const form = useForm();

    expect(form.isDirty.value).toBe(false);

    form.fields.value.label = "signing";
    expect(form.isDirty.value).toBe(true);
  });

  it("is clean again after reset", () => {
    const form = valid();
    form.reset();

    expect(form.isDirty.value).toBe(false);
    expect(form.fields.value.label).toBe("");
  });
});

describe("building the request", () => {
  it("trims the text fields and drops the empty optional ones", () => {
    const form = valid();
    form.fields.value.label = "  signing  ";
    form.fields.value.organization = "  Acme  ";
    form.fields.value.state = "   ";

    const request = form.buildRequest();

    expect(request.label).toBe("signing");
    expect(request.subject.organization).toBe("Acme");
    expect(request.subject.state).toBeUndefined();
  });

  it("upper-cases the country so the certificate carries a canonical code", () => {
    const form = valid();
    form.fields.value.country = "ch";

    expect(form.buildRequest().subject.country).toBe("CH");
  });

  it("sends dates as UTC midnight rather than local midnight", () => {
    const form = valid();
    form.fields.value.notBefore = new Date(2026, 5, 1, 23, 30);

    expect(form.buildRequest().validity.notBefore).toBe(
      "2026-06-01T00:00:00.000Z",
    );
  });
});
