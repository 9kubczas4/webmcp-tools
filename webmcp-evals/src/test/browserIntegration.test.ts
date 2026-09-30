/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as assert from "node:assert";
import http from "node:http";
import { describe, it } from "node:test";
import { BrowserToolRegistry, launchBrowser } from "../evaluator/browser.js";
import { evaluateDomAssertions } from "../simulate/domAssertions.js";

describe("Browser Integration", () => {
  it("should discover tools and inspect final DOM state on SPA hash routes", async (t) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <script>
              if (document.modelContext) {
                document.modelContext.registerTool({
                  name: 'test_spa_tool',
                  description: 'Tool registered on SPA page',
                  execute: () => ({ success: true, msg: 'hello' })
                });
              }
              // Simulate SPA client-side router navigation after initial script load
              setTimeout(() => {
                window.location.hash = '#/hash-route';
              }, 50);
            </script>
          </head>
          <body>
            <div class="cart-item">Jacket</div>
            <p id="status" data-state="completed">Checkout Completed</p>
          </body>
        </html>
      `);
    });

    await new Promise((resolve) => server.listen(0, () => resolve(undefined)));
    const port = (server.address() as any).port;
    const url = `http://localhost:${port}/#/hash-route`;

    let browser: any;
    try {
      browser = await launchBrowser();
    } catch {
      t.skip("Could not launch browser");
      server.close();
      return;
    }
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2" });

      const registry = new BrowserToolRegistry(page as any);
      const tools = registry.getCurrentTools();

      assert.strictEqual(tools.length, 1);
      assert.strictEqual(tools[0].functionName, "test_spa_tool");

      const result = await registry.executeTool("test_spa_tool", {});
      assert.deepStrictEqual(result, { success: true, msg: "hello" });

      const assertionResults = await evaluateDomAssertions(page, [
        { type: "dom", selector: ".cart-item", expect: { count: 1 } },
        { type: "dom", selector: "#status", expect: { text: { $contains: "Completed" } } },
        {
          type: "dom",
          selector: "#status",
          expect: { attribute: { name: "data-state", value: "completed" } },
        },
      ]);
      assert.deepStrictEqual(
        assertionResults.map((assertionResult) => assertionResult.outcome),
        ["pass", "pass", "pass"],
      );

      await page.close();
    } finally {
      await browser.close();
      server.close();
    }
  });
});
