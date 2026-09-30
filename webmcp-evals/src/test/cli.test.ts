/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as assert from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../bin/webmcp-evals.js", import.meta.url));

function help(...args: string[]): string {
  return execFileSync(process.execPath, [CLI, ...args], { encoding: "utf-8" });
}

describe("CLI backend option scope", () => {
  it("offers --backend only on commands implemented by the backend abstraction", () => {
    assert.doesNotMatch(help("--help"), /--backend/);
    assert.match(help("local", "--help"), /--backend/);
    assert.match(help("browser", "--help"), /--backend/);
    assert.doesNotMatch(help("smoke", "--help"), /--backend/);
    assert.doesNotMatch(help("simulate", "--help"), /--backend/);
  });

  it("rejects --backend instead of silently ignoring it for simulate", () => {
    const result = spawnSync(
      process.execPath,
      [CLI, "--backend", "gemini", "simulate", "-u", "https://example.test", "-s", "x.json"],
      { encoding: "utf-8" },
    );

    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /unknown option '--backend'/);
  });
});
