import { type ConsoleMessage, expect, test } from "@playwright/test"

/**
 * Cross-browser behavioral tests for gesture and scroll examples in the
 * playground. These run against Chromium, Firefox, and WebKit because
 * the underlying APIs (pointer events, scroll event ordering, WAAPI
 * coverage) differ enough across engines to hide regressions in any
 * single-browser test layer.
 *
 * Per-feature unit tests live in the package vitest suites against
 * happy-dom; this layer exists specifically to catch issues that only
 * surface in a real browser, so it stays small and behavioral rather
 * than exhaustive.
 */

test.describe("cross-browser gesture / scroll", () => {
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

  test("drag-gesture moves the box in response to pointer drag", async ({ page }) => {
    await page.goto("/")
    const card = page.locator('article.card[data-example-id="drag-gesture"]')
    await card.waitFor()
    const box = card.locator(".box").first()
    await box.waitFor()
    await box.scrollIntoViewIfNeeded()

    const before = await box.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { left: r.left, top: r.top }
    })

    // Use Playwright's mouse APIs (which emit real PointerEvents in
    // every supported browser) rather than dispatching synthetic events,
    // so we exercise the same code paths a user would.
    const startBox = await box.boundingBox()
    if (!startBox) throw new Error("drag-gesture: could not measure box bounds")
    const startX = startBox.x + startBox.width / 2
    const startY = startBox.y + startBox.height / 2

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    // Several intermediate steps are important on WebKit / Firefox so
    // pointermove fires more than once before pointerup.
    await page.mouse.move(startX + 40, startY + 30, { steps: 6 })
    await page.mouse.move(startX + 80, startY + 60, { steps: 6 })
    await page.mouse.up()

    // Allow the release inertia (or snap-to-bounds) to settle.
    await page.waitForTimeout(400)

    const after = await box.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { left: r.left, top: r.top }
    })

    // The box should have moved in roughly the drag direction. We do
    // not assert exact deltas because release inertia is browser /
    // timing dependent; we only need to prove the gesture pipeline
    // observed the pointer stream end-to-end.
    expect(Math.abs(after.left - before.left) + Math.abs(after.top - before.top)).toBeGreaterThan(5)

    expect(
      pageErrors,
      `unhandled page errors: ${pageErrors.map((e) => e.message).join("\n")}`,
    ).toHaveLength(0)
    expect(consoleErrors, `console errors: ${consoleErrors.join("\n")}`).toHaveLength(0)
  })

  test("scroll-synced updates as the page scrolls", async ({ page }) => {
    await page.goto("/")
    const card = page.locator('article.card[data-example-id="scroll-synced"]')
    await card.waitFor()
    // The bar is the first child div inside the example's stage (the
    // hint div comes after it).
    const bar = card.locator(".stage > div").first()
    await bar.waitFor()

    const sample = (): Promise<number> =>
      bar.evaluate((el) => {
        const v = (el as HTMLElement).style.getPropertyValue("--p").trim()
        return v.endsWith("%") ? Number.parseFloat(v) : Number.NaN
      })

    // Scroll to the very top so the card sits below the viewport
    // (progress should be near 0 with the trigger configured as
    // start: "top 100%"), then scroll the card into view to push
    // progress to a different value. This avoids a brittle
    // initial-position assumption across browsers.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
    await page.waitForTimeout(100)
    const before = await sample()

    await card.scrollIntoViewIfNeeded()
    await page.waitForFunction(
      ({ start }) => {
        const el = document.querySelector(
          'article.card[data-example-id="scroll-synced"] .stage > div',
        ) as HTMLElement | null
        if (!el) return false
        const v = el.style.getPropertyValue("--p").trim()
        if (!v.endsWith("%")) return false
        return Number.parseFloat(v) !== start
      },
      { start: before },
      { timeout: 5_000 },
    )

    const after = await sample()
    expect(Number.isNaN(after)).toBe(false)
    expect(after).not.toBe(before)

    expect(
      pageErrors,
      `unhandled page errors: ${pageErrors.map((e) => e.message).join("\n")}`,
    ).toHaveLength(0)
    expect(consoleErrors, `console errors: ${consoleErrors.join("\n")}`).toHaveLength(0)
  })

  test("hover-gesture reacts to pointer enter / leave", async ({ page }) => {
    await page.goto("/")
    const card = page.locator('article.card[data-example-id="hover-gesture"]')
    await card.waitFor()
    const target = card.locator(".box").first()
    await target.waitFor()
    await target.scrollIntoViewIfNeeded()

    const transformBefore = await target.evaluate((el) => getComputedStyle(el).transform)

    await target.hover()
    // Let the hover animation play.
    await page.waitForTimeout(250)
    const transformDuring = await target.evaluate((el) => getComputedStyle(el).transform)
    expect(transformDuring).not.toEqual(transformBefore)

    // Move the pointer well outside the card so the hover ends.
    await page.mouse.move(0, 0)
    await page.waitForTimeout(250)

    expect(
      pageErrors,
      `unhandled page errors: ${pageErrors.map((e) => e.message).join("\n")}`,
    ).toHaveLength(0)
    expect(consoleErrors, `console errors: ${consoleErrors.join("\n")}`).toHaveLength(0)
  })
})
