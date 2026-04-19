// Registers built-in interpolators so tests that import submodules
// directly (bypassing the public `index.ts` entry) still get the
// default dispatch coverage. Matches runtime behavior of `kinem`.
import "./src/interpolate/register-defaults"
