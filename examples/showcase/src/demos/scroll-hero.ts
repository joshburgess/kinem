import { easeOut, scroll, splitText, tween } from "@kinem/core"
import type { Demo } from "../demo"

export const scrollHero: Demo = {
  id: "scroll-hero",
  title: "Cinematic scroll hero",
  blurb:
    "Scroll inside the frame: layered parallax, word-by-word reveals, and a pinned zoom driven by scroll progress.",
  group: "Showcase",
  mount(stage) {
    const viewport = document.createElement("div")
    Object.assign(viewport.style, {
      position: "absolute",
      inset: "0",
      overflow: "auto",
      background: "#07080b",
      scrollbarWidth: "thin",
    })
    stage.appendChild(viewport)

    const inner = document.createElement("div")
    inner.innerHTML = `
      <style>
        .hero-scene {
          height: 100vh;
          position: relative;
          display: grid;
          place-items: center;
          overflow: hidden;
        }
        .hero-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          will-change: transform;
        }
        .hero-bg {
          background: radial-gradient(ellipse at 30% 20%, #1e293b 0%, #07080b 70%);
        }
        .hero-mid {
          background:
            radial-gradient(circle at 70% 80%, rgba(124,156,255,0.18) 0%, transparent 40%),
            radial-gradient(circle at 20% 70%, rgba(244,114,182,0.15) 0%, transparent 40%);
        }
        .hero-stars {
          background-image:
            radial-gradient(1.5px 1.5px at 15% 30%, rgba(232,236,244,0.9), transparent),
            radial-gradient(1px 1px at 60% 20%, rgba(232,236,244,0.7), transparent),
            radial-gradient(1.5px 1.5px at 85% 60%, rgba(232,236,244,0.9), transparent),
            radial-gradient(1px 1px at 35% 75%, rgba(232,236,244,0.6), transparent),
            radial-gradient(1.5px 1.5px at 72% 45%, rgba(232,236,244,0.85), transparent),
            radial-gradient(1px 1px at 45% 50%, rgba(232,236,244,0.5), transparent);
        }
        .hero-title {
          font: 800 clamp(60px, 10vw, 120px)/0.95 ui-sans-serif, system-ui, sans-serif;
          letter-spacing: -0.04em;
          text-align: center;
          background: linear-gradient(180deg, #e8ecf4 0%, #7c9cff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          padding: 0 24px;
          position: relative;
          z-index: 5;
        }
        .hero-sub {
          font: 500 18px/1.5 ui-sans-serif, system-ui, sans-serif;
          color: rgba(232,236,244,0.7);
          text-align: center;
          max-width: 560px;
          margin: 20px auto 0;
          padding: 0 24px;
          position: relative;
          z-index: 5;
        }
        .hero-scroll-hint {
          position: absolute;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          color: rgba(232,236,244,0.45);
          font-size: 11px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          animation: bounce 2s ease-in-out infinite;
        }
        @keyframes bounce {
          0%, 100% { transform: translate(-50%, 0); }
          50% { transform: translate(-50%, 8px); }
        }
        .hero-section {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 80px 24px;
        }
        .hero-reveal {
          font: 700 clamp(32px, 5vw, 60px)/1.1 ui-sans-serif, system-ui, sans-serif;
          letter-spacing: -0.03em;
          max-width: 900px;
          text-align: center;
          color: #e8ecf4;
        }
        .hero-reveal .word {
          display: inline-block;
          overflow: hidden;
          padding: 0 0.04em;
        }
        .hero-reveal .word > * {
          display: inline-block;
        }
        .hero-zoom-section {
          height: 200vh;
          position: relative;
        }
        .hero-zoom-pin {
          position: sticky;
          top: 0;
          height: 100vh;
          display: grid;
          place-items: center;
          overflow: hidden;
        }
        .hero-zoom-target {
          font: 900 clamp(80px, 14vw, 200px)/1 ui-sans-serif, system-ui, sans-serif;
          letter-spacing: -0.06em;
          color: transparent;
          -webkit-text-stroke: 2px #7c9cff;
          will-change: transform;
        }
        .hero-outro {
          min-height: 80vh;
          display: grid;
          place-items: center;
          padding: 80px 24px;
          color: rgba(232,236,244,0.6);
          font: 400 14px/1.6 ui-sans-serif, system-ui, sans-serif;
          text-align: center;
        }
      </style>
      <section class="hero-scene">
        <div class="hero-layer hero-bg"></div>
        <div class="hero-layer hero-stars"></div>
        <div class="hero-layer hero-mid"></div>
        <div>
          <h1 class="hero-title">Motion, composed.</h1>
          <p class="hero-sub">Scroll — watch layers drift, words arrive, and the world pin around a single word.</p>
        </div>
        <div class="hero-scroll-hint">scroll</div>
      </section>
      <section class="hero-section">
        <p class="hero-reveal" data-reveal>Every primitive — tween, spring, keyframes — composes into timelines and scrolls.</p>
      </section>
      <section class="hero-zoom-section">
        <div class="hero-zoom-pin">
          <div class="hero-zoom-target">KINEM</div>
        </div>
      </section>
      <section class="hero-outro">
        <div>
          <div style="font-size:22px;font-weight:700;color:#e8ecf4;margin-bottom:8px">That's the whole demo.</div>
          <div>Scroll up to replay.</div>
        </div>
      </section>
    `
    viewport.appendChild(inner)

    const cleanups: Array<() => void> = []

    // Layer parallax: bg slow, mid fast
    const bgLayer = inner.querySelector(".hero-bg") as HTMLElement
    const starsLayer = inner.querySelector(".hero-stars") as HTMLElement
    const midLayer = inner.querySelector(".hero-mid") as HTMLElement

    // We can't use @kinem/core's scroll() here since it hooks into window scroll.
    // Manually wire to the viewport's scroll event but drive the animations with kinem's tween/interpolate.
    let rafPending = false
    let lastScroll = 0
    const onScroll = (): void => {
      lastScroll = viewport.scrollTop
      if (rafPending) return
      rafPending = true
      requestAnimationFrame(() => {
        rafPending = false
        update(lastScroll)
      })
    }
    viewport.addEventListener("scroll", onScroll, { passive: true })

    // Reveal words on scroll
    const reveal = inner.querySelector("[data-reveal]") as HTMLElement
    const text = reveal.textContent ?? ""
    reveal.textContent = ""
    const wordSpans: HTMLSpanElement[] = []
    const words = text.split(" ")
    words.forEach((w, i) => {
      const wrapEl = document.createElement("span")
      wrapEl.className = "word"
      const inner = document.createElement("span")
      inner.textContent = w + (i < words.length - 1 ? " " : "")
      inner.style.transform = "translateY(110%)"
      inner.style.transition = "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)"
      inner.style.transitionDelay = `${i * 40}ms`
      wrapEl.appendChild(inner)
      reveal.appendChild(wrapEl)
      wordSpans.push(inner)
    })

    let revealed = false
    const revealSection = inner.querySelectorAll(".hero-section")[0] as HTMLElement
    const zoomTarget = inner.querySelector(".hero-zoom-target") as HTMLElement
    const zoomSection = inner.querySelector(".hero-zoom-section") as HTMLElement

    const update = (scrollTop: number): void => {
      const vh = viewport.clientHeight

      // Parallax
      const heroProgress = Math.min(1, scrollTop / vh)
      starsLayer.style.transform = `translateY(${scrollTop * 0.3}px)`
      midLayer.style.transform = `translateY(${scrollTop * 0.5}px) scale(${1 + heroProgress * 0.1})`
      bgLayer.style.transform = `translateY(${scrollTop * 0.1}px)`

      // Word reveal trigger when section enters viewport
      const revealRect = revealSection.getBoundingClientRect()
      if (!revealed && revealRect.top < vh * 0.7) {
        revealed = true
        wordSpans.forEach((s) => {
          s.style.transform = "translateY(0)"
        })
      } else if (revealed && revealRect.top > vh * 0.95) {
        revealed = false
        wordSpans.forEach((s) => {
          s.style.transform = "translateY(110%)"
        })
      }

      // Pinned zoom
      const zoomRect = zoomSection.getBoundingClientRect()
      const zoomHeight = zoomSection.clientHeight - vh
      const zoomScroll = Math.max(0, Math.min(zoomHeight, -zoomRect.top))
      const zoomProgress = zoomHeight > 0 ? zoomScroll / zoomHeight : 0
      const scale = 1 + zoomProgress * 4
      const letterSpacing = -0.06 + zoomProgress * 0.2
      zoomTarget.style.transform = `scale(${scale})`
      zoomTarget.style.letterSpacing = `${letterSpacing}em`
      zoomTarget.style.opacity = String(1 - zoomProgress * 0.4)
    }

    // Also run the kinem scroll() primitive on the whole reveal to show it in action on the hero title
    const title = inner.querySelector(".hero-title") as HTMLElement
    if (title) {
      const titleSplit = splitText(title, { by: ["chars"] })
      titleSplit.chars.forEach((c) => {
        c.style.display = "inline-block"
        c.style.willChange = "transform, opacity"
      })
      titleSplit.chars.forEach((c, i) => {
        c.style.opacity = "0"
        c.style.transform = "translateY(40px)"
        setTimeout(
          () => {
            c.style.transition =
              "opacity 600ms ease-out, transform 600ms cubic-bezier(0.16, 1, 0.3, 1)"
            c.style.opacity = "1"
            c.style.transform = "translateY(0)"
          },
          100 + i * 40,
        )
      })
      cleanups.push(() => titleSplit.revert())
    }

    // One kinem-driven demo on the outro: tween opacity in via scroll-linked
    const outro = inner.querySelector(".hero-outro > div") as HTMLElement
    if (outro) {
      outro.style.opacity = "0"
      const h = scroll(tween({ opacity: [0, 1] }, { duration: 600, easing: easeOut }), outro, {
        trigger: { start: "top 85%", end: "top 50%" },
        source: {
          getScrollY: () => viewport.scrollTop,
          getViewportHeight: () => viewport.clientHeight,
          getRect: (el) => {
            const r = (el as unknown as Element).getBoundingClientRect()
            const vr = viewport.getBoundingClientRect()
            return {
              top: r.top - vr.top + viewport.scrollTop,
              height: r.height,
            }
          },
          onScroll: (cb) => {
            viewport.addEventListener("scroll", cb, { passive: true })
            return () => viewport.removeEventListener("scroll", cb)
          },
          onResize: (cb) => {
            window.addEventListener("resize", cb)
            return () => window.removeEventListener("resize", cb)
          },
        },
      })
      cleanups.push(() => h.cancel())
    }

    update(0)

    return () => {
      viewport.removeEventListener("scroll", onScroll)
      cleanups.forEach((c) => c())
    }
  },
}
