import { describe, expect, it } from "vitest";
import { ref } from "vue";

import { useForm } from "./useForm";

const build = (currentLabel = "original") => {
  const visible = ref(true);
  const renamed: string[] = [];
  const form = useForm({
    visible,
    currentLabel: () => currentLabel,
    rename: (label) => renamed.push(label),
  });

  return { form, visible, renamed };
};

describe("validation", () => {
  it("refuses an empty name", () => {
    const { form, renamed } = build();
    form.reset();
    form.label.value = "   ";

    form.submit();

    expect(form.error.value).toBe("A name is required.");
    expect(renamed).toEqual([]);
  });

  it("refuses a name over 200 characters", () => {
    const { form, renamed } = build();
    form.label.value = "x".repeat(201);

    form.submit();

    expect(form.error.value).toContain("200");
    expect(renamed).toEqual([]);
  });
});

describe("submitting", () => {
  it("emits the trimmed name", () => {
    const { form, renamed } = build();
    form.label.value = "  renamed  ";

    form.submit();

    expect(renamed).toEqual(["renamed"]);
  });

  it("starts from the current name so reopening does not lose it", () => {
    const { form } = build("my certificate");

    form.reset();

    expect(form.label.value).toBe("my certificate");
    expect(form.error.value).toBe("");
  });

  it("closes without renaming", () => {
    const { form, visible, renamed } = build();

    form.close();

    expect(visible.value).toBe(false);
    expect(renamed).toEqual([]);
  });
});
