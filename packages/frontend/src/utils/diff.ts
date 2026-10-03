type DiffLine = {
  kind: "Same" | "Added" | "Removed";
  text: string;
};

export type LineDiff = {
  lines: DiffLine[];
  added: number;
  removed: number;
  isApproximate: boolean;
};

const BUDGET = 1200;

const walk = (left: string[], right: string[]): DiffLine[] => {
  const width = right.length + 1;
  const table = new Int32Array((left.length + 1) * width);
  const at = (row: number, column: number): number =>
    table[row * width + column] ?? 0;

  for (let row = left.length - 1; row >= 0; row -= 1) {
    for (let column = right.length - 1; column >= 0; column -= 1) {
      table[row * width + column] =
        left[row] === right[column]
          ? at(row + 1, column + 1) + 1
          : Math.max(at(row + 1, column), at(row, column + 1));
    }
  }

  const lines: DiffLine[] = [];
  let row = 0;
  let column = 0;

  while (row < left.length && column < right.length) {
    if (left[row] === right[column]) {
      lines.push({ kind: "Same", text: left[row] ?? "" });
      row += 1;
      column += 1;
      continue;
    }

    if (at(row + 1, column) >= at(row, column + 1)) {
      lines.push({ kind: "Removed", text: left[row] ?? "" });
      row += 1;
      continue;
    }

    lines.push({ kind: "Added", text: right[column] ?? "" });
    column += 1;
  }

  for (; row < left.length; row += 1) {
    lines.push({ kind: "Removed", text: left[row] ?? "" });
  }
  for (; column < right.length; column += 1) {
    lines.push({ kind: "Added", text: right[column] ?? "" });
  }

  return lines;
};

export const buildLineDiff = (before: string, after: string): LineDiff => {
  const left = before.split("\n");
  const right = after.split("\n");

  let head = 0;
  while (
    head < left.length &&
    head < right.length &&
    left[head] === right[head]
  ) {
    head += 1;
  }

  let tail = 0;
  while (
    tail < left.length - head &&
    tail < right.length - head &&
    left[left.length - 1 - tail] === right[right.length - 1 - tail]
  ) {
    tail += 1;
  }

  const leftBand = left.slice(head, left.length - tail);
  const rightBand = right.slice(head, right.length - tail);
  const isApproximate = leftBand.length * rightBand.length > BUDGET * BUDGET;

  const middle: DiffLine[] = isApproximate
    ? [
        ...leftBand.map((text): DiffLine => ({ kind: "Removed", text })),
        ...rightBand.map((text): DiffLine => ({ kind: "Added", text })),
      ]
    : walk(leftBand, rightBand);

  const lines: DiffLine[] = [
    ...left.slice(0, head).map((text): DiffLine => ({ kind: "Same", text })),
    ...middle,
    ...left
      .slice(left.length - tail)
      .map((text): DiffLine => ({ kind: "Same", text })),
  ];

  return {
    lines,
    added: lines.filter((line) => line.kind === "Added").length,
    removed: lines.filter((line) => line.kind === "Removed").length,
    isApproximate,
  };
};
