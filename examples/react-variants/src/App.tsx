import { Motion, type Variants } from "@kinem/react"
import { useState } from "react"

const drawerVariants: Variants = {
  closed: { transform: "translateX(-100%)", opacity: 0 },
  open: { transform: "translateX(0%)", opacity: 1 },
}

const itemVariants: Variants = {
  closed: { opacity: 0, transform: "translateY(8px)" },
  open: { opacity: 1, transform: "translateY(0px)" },
}

const cardVariants: Variants = {
  rest: { transform: "scale(1)" },
  hover: { transform: "scale(1.04)" },
  tap: { transform: "scale(0.96)" },
}

export function App(): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <main>
      <header>
        <h1>kinem variants</h1>
        <p>
          Each section flips a parent state machine. Children that share the variant vocabulary
          inherit the key automatically; staggerChildren delays each child by its mount-order index.
        </p>
      </header>

      <section>
        <h2>Drawer with whileHover trigger</h2>
        <p>The button uses `whileHover` and `whileTap`. Click it to flip the drawer.</p>
        <div className="row">
          <Motion
            as="button"
            type="button"
            variants={cardVariants}
            initial="rest"
            animate="rest"
            whileHover="hover"
            whileTap="tap"
            transition={{ duration: 180 }}
            onClick={() => setOpen((v) => !v)}
            className="trigger"
          >
            {open ? "close drawer" : "open drawer"}
          </Motion>
          <div className="drawer-frame">
            <Motion
              variants={drawerVariants}
              initial="closed"
              animate={open ? "open" : "closed"}
              transition={{ duration: 320, staggerChildren: 60 }}
              className="drawer"
            >
              {["dashboard", "projects", "settings", "logout"].map((label) => (
                <Motion
                  key={label}
                  variants={itemVariants}
                  transition={{ duration: 220 }}
                  className="drawer-item"
                >
                  {label}
                </Motion>
              ))}
            </Motion>
          </div>
        </div>
      </section>

      <section>
        <h2>Card grid: whileHover + whileTap</h2>
        <p>Each card has its own state machine; hover and press to see the flip.</p>
        <div className="grid">
          {["one", "two", "three", "four", "five", "six"].map((label, i) => (
            <Motion
              key={label}
              variants={cardVariants}
              initial="rest"
              animate="rest"
              whileHover="hover"
              whileTap="tap"
              transition={{ duration: 180 }}
              className="card"
            >
              card {i + 1}
            </Motion>
          ))}
        </div>
      </section>
    </main>
  )
}
