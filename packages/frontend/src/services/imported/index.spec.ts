import { beforeEach, describe, expect, it } from "vitest";

import {
  forgetImportedCertificates,
  onCertificatesImported,
  rememberImportedCertificates,
  trackImportedCertificates,
} from "./index";

const buildBadge = () => {
  const counts: number[] = [];
  trackImportedCertificates({ setCount: (count) => counts.push(count) });
  return counts;
};

describe("telling the user certificates arrived", () => {
  beforeEach(() => forgetImportedCertificates());

  it("shows nothing until something is imported", () => {
    const counts = buildBadge();

    expect(counts).toStrictEqual([0]);
  });

  it("counts each certificate as it is sent", () => {
    const counts = buildBadge();

    rememberImportedCertificates(1);
    rememberImportedCertificates(1);

    expect(counts.at(-1)).toBe(2);
  });

  it("clears the badge when the page is opened", () => {
    const counts = buildBadge();
    rememberImportedCertificates(3);

    forgetImportedCertificates();

    expect(counts.at(-1)).toBe(0);
  });

  it("does not redraw the badge when nothing was sent", () => {
    const counts = buildBadge();

    rememberImportedCertificates(0);

    expect(counts).toStrictEqual([0]);
  });

  it("does not redraw the badge when it is already clear", () => {
    const counts = buildBadge();

    forgetImportedCertificates();

    expect(counts).toStrictEqual([0]);
  });

  it("keeps counting after the badge was cleared", () => {
    const counts = buildBadge();
    rememberImportedCertificates(2);
    forgetImportedCertificates();

    rememberImportedCertificates(1);

    expect(counts.at(-1)).toBe(1);
  });
});

describe("telling an open page that certificates arrived", () => {
  it("notifies a listener so it can reload without a manual refresh", () => {
    buildBadge();
    const seen: number[] = [];
    onCertificatesImported(() => seen.push(1));

    rememberImportedCertificates(1);
    rememberImportedCertificates(2);

    expect(seen).toHaveLength(2);
  });

  it("says nothing when nothing was imported", () => {
    buildBadge();
    const seen: number[] = [];
    onCertificatesImported(() => seen.push(1));

    rememberImportedCertificates(0);

    expect(seen).toStrictEqual([]);
  });

  it("stops notifying once the listener unsubscribes", () => {
    buildBadge();
    const seen: number[] = [];
    const stop = onCertificatesImported(() => seen.push(1));

    stop();
    rememberImportedCertificates(1);

    expect(seen).toStrictEqual([]);
  });
});
