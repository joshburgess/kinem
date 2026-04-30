declare module "cubejs" {
  // cubejs ships as a CommonJS bundle without types. We only use a tiny
  // surface (fromString + solve + initSolver). Keep this declaration
  // narrow so we can extend it later without sprawling.
  export default class Cube {
    static fromString(str: string): Cube
    static initSolver(): void
    solve(maxDepth?: number): string
    asString(): string
    isSolved(): boolean
  }
}
