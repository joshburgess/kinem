import { expect, test } from "@playwright/test"

/**
 * Visual regression suite. Locks the rendered look of stable, non-animated
 * UI surfaces (the playground shell, card layout, and a handful of
 * post-settled animation states) against committed baselines.
 *
 * To regenerate baselines after an intentional visual change:
 *   pnpm e2e:visual --update-snapshots
 *
 * The suite uses Playwright's `animations: "disabled"` option, which
 * pauses CSS animations and waits for the page to be visually stable
 * before capturing. WAAPI / rAF-driven animations are paused indirectly
 * by emulating `prefers-reduced-motion: reduce` and giving the consuming
 * code (which honours the OS pref through the kinem reduced-motion
 * gate) a beat to commit final-frame values.
 *
 * This suite is opt-in: it runs only when matched explicitly (the
 * `*.visual.spec.ts` filename pattern is excluded from the default
 * `pnpm e2e` matcher). Run it via `pnpm e2e:visual`.
 */

test.use({ colorScheme: "light", reducedMotion: "reduce" })

test.describe("playground visual baselines", () => {
  test("page shell renders consistently", async ({ page }) => {
    await page.goto("/")
    await page.locator("article.card").first().waitFor()
    // Allow the first paint to settle.
    await page.waitForTimeout(200)
    await expect(page).toHaveScreenshot("shell.png", {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
      mask: [
        // Animated content inside cards isn't byte-stable across runs.
        // The shell screenshot is about layout, typography, and the card
        // chrome; the animated stages are masked out.
        page.locator("article.card .stage"),
      ],
    })
  })

  test("card chrome for the tween-basic example", async ({ page }) => {
    await page.goto("/")
    const card = page.locator('article.card[data-example-id="tween-basic"]')
    await card.waitFor()
    await expect(card).toHaveScreenshot("card-tween-basic.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
      mask: [card.locator(".stage")],
    })
  })

  test("card chrome for the spring-drop example", async ({ page }) => {
    await page.goto("/")
    const card = page.locator('article.card[data-example-id="spring-drop"]')
    await card.waitFor()
    await expect(card).toHaveScreenshot("card-spring-drop.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
      mask: [card.locator(".stage")],
    })
  })
})
