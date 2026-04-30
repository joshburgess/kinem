import type { ReorderController } from "@kinem/core"
import { createContext } from "solid-js"

export const ReorderContext = createContext<() => ReorderController<unknown> | null>(() => null)
