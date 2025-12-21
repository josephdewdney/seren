import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { test, expect, afterEach } from "bun:test";

const cli = `node --experimental-strip-types ${import.meta.dir}/index.ts`;
const testDir = "/tmp/seren-test";

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }
});

test("init creates a monorepo", () => {
  execSync(`${cli} init ${testDir}`);
  expect(existsSync(testDir)).toBe(true);
  expect(existsSync(`${testDir}/package.json`)).toBe(true);
  expect(existsSync(`${testDir}/apps`)).toBe(true);
  expect(existsSync(`${testDir}/packages/tsconfig`)).toBe(true);
  expect(existsSync(`${testDir}/.git`)).toBe(true);
});

test("init fails if directory exists", () => {
  execSync(`mkdir -p ${testDir}`);
  expect(() => execSync(`${cli} init ${testDir}`)).toThrow();
});
