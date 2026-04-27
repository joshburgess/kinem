import { type ConsoleMessage, expect, test } from "@playwright/test"

/**
 * Smoke test for examples/playground. Visits the page once, verifies
 * every example mounted (no `data-example-status="failed"` cards), and
 * fails the run on any console error or unhandled page error.
 *
 * The single-page strategy is deliberate: the playground mounts every
 * example concurrently on load, so one navigation is enough to exercise
 * all of them. Per-example assertions are cheap because they're just
 * locator queries against the same DOM.
 */

test.describe("examples/playground smoke", () => {
  let consoleErrors: string[] = []
  let pageErrors: Error[] = []

  test.beforeEach(({ page }) => {
    consoleErrors = []
    pageErrors = []
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") consoleErrors.push(msg.text())
    })
    page.on("pageerror", (err) => {
      pageErrors.push(err)
    })
  })

  test("renders the page shell", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("h1")).toHaveText(/kinem examples/i)
    await expect(page.locator("article.card").first()).toBeVisible()
  })

  test("every example mounts without error", async ({ page }) => {
    await page.goto("/")
    // Wait for at least one card so we know the script booted.
    await page.locator("article.card").first().waitFor()

    const cards = page.locator("article.card")
    const total = await cards.count()
    expect(total).toBeGreaterThan(0)

    // Every card must report mounted; none may report failed.
    const failed = page.locator('article.card[data-example-status="failed"]')
    expect(await failed.count()).toBe(0)

    const mounted = page.locator('article.card[data-example-status="mounted"]')
    expect(await mounted.count()).toBe(total)

    expect(
      pageErrors,
      `unhandled page errors: ${pageErrors.map((e) => e.message).join("\n")}`,
    ).toHaveLength(0)
    expect(consoleErrors, `console errors: ${consoleErrors.join("\n")}`).toHaveLength(0)
  })

  test("a tween example actually animates", async ({ page }) => {
    await page.goto("/")
    const card = page.locator('article.card[data-example-id="tween-basic"]')
    await card.waitFor()
    const dot = card.locator(".box").first()
    await dot.waitFor()
    // Sample the transform at two points; values should change as the
    // animation plays, proving real frames ran in the real browser.
    const t0 = await dot.evaluate((el) => getComputedStyle(el).transform)
    await page.waitForTimeout(250)
    const t1 = await dot.evaluate((el) => getComputedStyle(el).transform)
    expect(t1).not.toEqual(t0)
  })
})
