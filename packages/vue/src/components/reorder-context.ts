import type { ReorderController } from "@kinem/core"
import type { InjectionKey } from "vue"

export const ReorderKey: InjectionKey<ReorderController<unknown>> = Symbol("kinem.reorder.group")
