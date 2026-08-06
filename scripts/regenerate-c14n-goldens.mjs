import { execFileSync, spawnSync } from "child_process";
import { readdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const CORPUS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages",
  "frontend",
  "src",
  "tests",
  "c14n",
);

const probe = spawnSync("xmllint", ["--version"], { encoding: "utf8" });
if (probe.status !== 0) {
  process.stderr.write("xmllint is required to regenerate the goldens\n");
  process.exit(1);
}

const version = `${probe.stdout}${probe.stderr}`.trim().replace(/\s+/g, " ");

const inputs = readdirSync(CORPUS)
  .filter((name) => name.endsWith(".xml"))
  .sort();

for (const name of inputs) {
  const path = join(CORPUS, name);
  const exclusive = execFileSync("xmllint", ["--exc-c14n", path], {
    encoding: "utf8",
  });
  writeFileSync(path.replace(/\.xml$/, ".exc"), exclusive);
  process.stdout.write(`${name}: ${exclusive.length}b exclusive\n`);
}

process.stdout.write(
  `\n${String(inputs.length)} fixtures canonicalized by ${version}\n` +
    `Canonical output can differ between libxml2 releases, so this moves the baseline. Run the suite.\n`,
);
