import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { test, afterEach } from "node:test";
import assert from "node:assert";

const cli = `node --experimental-strip-types ${import.meta.dirname}/index.ts`;
const testDir = "/tmp/seren-test";

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }
});

test("init creates a monorepo", () => {
  execSync(`${cli} init ${testDir}`);
  assert.strictEqual(existsSync(testDir), true);
  assert.strictEqual(existsSync(`${testDir}/package.json`), true);
  assert.strictEqual(existsSync(`${testDir}/apps`), true);
  assert.strictEqual(existsSync(`${testDir}/packages/tsconfig`), true);
  assert.strictEqual(existsSync(`${testDir}/.git`), true);
});

test("init is idempotent", () => {
  execSync(`${cli} init ${testDir}`);
  // Running again should succeed (not throw)
  execSync(`${cli} init ${testDir}`);
});

test("init with nested path uses directory name as package name", () => {
  execSync(`${cli} init ${testDir}/nested/my-app`);
  const pkg = JSON.parse(readFileSync(`${testDir}/nested/my-app/package.json`, "utf-8"));
  assert.strictEqual(pkg.name, "my-app");
});
