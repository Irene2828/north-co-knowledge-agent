import { test, expect } from "@playwright/test";
import examples from "../src/examples.json" with { type: "json" };
test("offline examples, retry, review and all views work on desktop and mobile", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Company knowledge. With receipts." }),
  ).toBeVisible();
  await expect(page.locator("#connection")).toContainText("Connect a key");
  await expect(page.locator("#ask")).toBeDisabled();
  await page.getByRole("button", { name: "03 Catch & correct" }).click();
  await expect(page.locator("#answer")).toContainText("30 days");
  await expect(page.locator("#answer")).toContainText("1 retry");
  await expect(page.locator("#pipeline")).toContainText("NEEDS FIX");
  await page.getByRole("button", { name: "02 An honest unknown" }).click();
  await expect(page.locator("#answer")).toContainText("I don't know");
  await page.getByRole("button", { name: "Approve reviewed answer" }).click();
  await expect(page.locator("#answer")).toContainText("approved in demo");
  await page.getByRole("link", { name: "How it works", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The evals", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Runs 03/ }).click();
  await expect(page.locator(".run")).toHaveCount(3);
  await page.getByRole("link", { name: "The case", exact: true }).click();
  await expect(
    page.getByText("No live measurements in this session yet.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Demo", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("streamed API fixture renders events and persists the result to session Runs", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { configured: true } }),
  );
  const run = structuredClone(examples[0]);
  run.example = false;
  run.durationMs = 1234;
  run.id = "browser-fixture";
  await page.route("**/api/run", (route) =>
    route.fulfill({
      contentType: "application/x-ndjson",
      body:
        run.events
          .map((event) => JSON.stringify({ type: "event", event }))
          .join("\n") +
        "\n" +
        JSON.stringify({ type: "result", run }) +
        "\n",
    }),
  );
  await page.goto("/");
  await page.locator("#question").fill(run.question);
  await page.getByRole("button", { name: "Ask a question" }).click();
  await expect(page.locator("#answer")).toContainText("30%");
  await expect(page.locator("#pipeline")).toContainText("Employee discount");
  await page.getByRole("link", { name: /Runs 04/ }).click();
  await expect(page.locator(".run")).toHaveCount(4);
  await page.reload();
  await expect(page.locator(".run")).toHaveCount(4);
  await page.getByRole("button", { name: "Clear session runs" }).click();
  await expect(page.locator(".run")).toHaveCount(3);
});
