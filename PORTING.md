# Porting egui to Node.js

A TypeScript port of [egui](https://github.com/emilk/egui), tracking the Rust
`main` branch. See `crates/` for the reference source.

## Scope and target

egui is ~135k lines of Rust across 16 crates. This port targets a **headless
core + pluggable renderer**: the geometry, colour, text-layout and UI-logic
layers are ported faithfully, and the output (`Tessellation`, `Mesh`,
`ClippedPrimitive`, `RawInput`, `FullOutput`) is consumed by a renderer that the
user supplies.

The native crates are intentionally **not** ported, because they have no
Node.js equivalent:

| Rust crate | Lines | Why it is out of scope |
|---|---:|---|
| `eframe` | 12019 | owns the event loop, window and platform integration |
| `egui-winit` | 3422 | winit windowing bindings |
| `egui_glow` | 1730 | OpenGL (via `glow`) backend |
| `egui-wgpu` | 3239 | wgpu backend |
| `egui_system_fonts` | 261 | OS font enumeration |

A headless core produces the same tessellation those crates would have drawn, so
a WebGL, Canvas2D or terminal renderer can be layered on later without changing
any ported logic.

## Progress

| Crate | Rust lines | Status |
|---|---:|---|
| `emath` | 5096 | **done** - 105 tests |
| `ecolor` | 1844 | **done** - 34 tests |
| `epaint` | 19177 | **in progress** - 98 tests |
| `egui` | 59582 | pending |
| `egui_extras` | 6188 | pending |
| others | — | out of scope (see above) |

`epaint` progress, of 19k lines:

| Module | Lines | Status |
|---|---:|---|
| `margin`, `margin_f32` | 567 | done |
| `corner_radius`, `corner_radius_f32` | 544 | done |
| `stroke`, `color` | 292 | done |
| `brush`, `direction`, `TextureId` | ~120 | done |
| `mesh`, `viewport`, `paint_callback` | ~700 | done |
| `rounded_rect` | 250 | done |
| `shapes/*` (circle, ellipse, rect, path, band, bezier, shape) | ~2600 | done |
| `shapes/text_shape` | 213 | pending (needs `text/*`) |
| `tessellator` | 2950 | pending |
| `text/*` | ~7000 | pending |
| `textures`, `texture_atlas`, `image` | ~1150 | pending |

## Layout

```
packages/
  emath/            @egui-node/emath
    src/*.ts        one file per Rust module, same names
    src/*.test.ts   ported Rust unit tests + doctests
  ecolor/           @egui-node/ecolor
  epaint/           @egui-node/epaint
```

One TS module per `.rs` file keeps the diff against upstream auditable: open
`crates/emath/src/rect.rs`, open `packages/emath/src/rect.ts`, and they should
be line-for-line comparable.

### Integer types

`Color32` is four `u8`s. JavaScript has no integer types, so components are
plain numbers in `[0, 255]`, and the helpers in
`packages/ecolor/src/internal.ts` reproduce Rust's integer semantics:

- **`as u8` saturates.** Rust's float-to-int `as` cast truncates *and* saturates
  to the target range. `| 0` and `Math.trunc` truncate but do not saturate, so
  `fast_round(255.5)` silently becomes `255` by luck but `sat_u8(300)` would
  become `44` with a naive `trunc`. Use `sat_u8` / `fast_round`.
- **`u8::saturating_add`** is `saturating_add_u8`, used by `Color32::add`.
- **`mul_frac_round`** stays in fixed-point integer arithmetic, and the
  `mul_frac_round_vs_old` test checks it against the float version.

### `Result` vs exceptions

Rust's `FromStr` returns a `Result`, so hex parsing returns a discriminated
union (`{ok: true, value} | {ok: false, error}`) rather than throwing, keeping
upstream's behaviour for untrusted input. The convenience wrappers
(`color32_from_hex`, `hex_color`) do throw, because they are used on literals
and in tests where a failure is a bug.

### Rust enums

There are three shapes in this codebase, each with its own TypeScript analogue:

| Rust | TypeScript | Used for |
|---|---|---|
| unit enum | `type T = 'A' \| 'B'` + named consts | `Align`, `StrokeKind`, `Direction` |
| enum with a single field | `{kind: 'A', value: V}` union | `ColorMode`, `TextureId` |
| enum with per-variant fields | `{kind: 'X', ...payload}` union | `Shape` |
| `struct` of fields | `class` with public fields | `Color32`, `Stroke`, `Margin` |

`ColorMode` and `TextureId` are the middle case. `ColorMode::UV` holds an
`Arc<dyn Fn>`; Rust hand-writes its `PartialEq` so that two closures are never
equal, which `colorModeEquals` reproduces.

`Shape` is the widest case: thirteen variants, each with a different payload, and
a `visual_bounding_rect` plus a `transform` that both dispatch on the
discriminant. TypeScript narrows the union in a `switch`, but because `Shape` is
a union of *object literals* rather than classes, the "methods" become free
functions (`visual_bounding_rect(shape)`, `transform(shape, ts)`) rather than
methods on a `Shape` class. A class hierarchy would reintroduce the shared-base-
class problems, so the tagged union is closer to the Rust anyway.

### `Arc<dyn Any>` callbacks

`PaintCallback::callback` is an `Arc<dyn Any + Send + Sync>` that each backend
downcasts to what it expects, and `PartialEq` uses `Arc::ptr_eq`. Here it is
`unknown`, compared by `===`.

### `mem::size_of` assertions

Rust has tests like `assert_eq!(size_of::<Shape>(), 64)` to stop these
enums growing. They do not apply to JS, where object layout is the engine's
business. `Mesh::bytes_used` therefore reports an approximate element count
rather than a byte count, and this is called out in its doc comment.

### `u32::from_be_bytes`

Several places build a hex number out of byte components. In JS that overflows
`Number.MAX_SAFE_INTEGER` once a full byte lands at the top, so those use `>>>`
and explicit `& 0xff` masking to stay in 32-bit space.

### `let x = ...x...`

Rust shadows freely (`let h = (h.fract() + 1.0).fract();`). In JavaScript that
is a temporal-dead-zone error, so shadowed locals get a new name. This was a real
bug caught by the tests in `rgb_from_hsv`.

## The Rust font stack

`epaint`'s text subsystem leans on four upstream Rust crates. Node has no
direct equivalent for three of them, so each gets a TypeScript replacement in a
`node.js` branch on a fork under `carlos20260001`:

| Upstream crate | Role in egui | TS replacement lives in |
|---|---|---|
| `skrifa` | glyph metrics, charmap, outlines | [`carlos20260001/fontations`](https://github.com/carlos20260001/fontations/tree/node.js) `node-js-port/` |
| `vello_cpu` | glyph rasterization | [`carlos20260001/vello`](https://github.com/carlos20260001/vello/tree/node.js) `node-js-port/` |
| `peniko` | paint/fill layer | [`carlos20260001/peniko`](https://github.com/carlos20260001/peniko/tree/node.js) `node-js-port/` |
| `fontique` | font discovery and matching | [`carlos20260001/parley`](https://github.com/carlos20260001/parley/tree/node.js) `node-js-port/` |

Two of these are not separate repos: `vello_cpu` lives inside `linebender/vello`,
and `fontique` inside `linebender/parley`. Note also that **`skrifa`'s repo is
`googlefonts/fontations`**, not a `skrifa` repo - the `Skrifa/Skrifa` GitHub org
is an unrelated web word processor.

**Shaping** (`harfrust`) is replaced by
[HarfBuzzJS](https://harfbuzz.github.io/harfbuzzjs), which is maintained by the
HarfBuzz project itself rather than being a third-party wrapper. Caveats: it is
built with `-DHB_TINY` (so `HB_NO_OT_GLYPH_NAMES`), and v1.0 is a breaking
rewrite, so the `0.10.x` line is the one to pin.

### Licence

All four crates are `MIT OR Apache-2.0`, identical to egui's own dual licence,
and each ships both `LICENSE-MIT` and `LICENSE-APACHE`. The TypeScript ports
inherit that. This was checked before anything was forked.

### Local reference clones

Reference clones live in `vendor/rust-fontstack/` and are gitignored (nested
git repos, vendored, not part of this project's source). They are shallow
clones of `main`; note that `main` is ahead of what egui pins:

| Crate | egui pins | clone is at |
|---|---|---|
| `skrifa` | 0.44.0 | 0.48.0 |
| `vello_cpu` | 0.2.0 | 0.3.0 |
| `fontique` | 0.11.1 | 0.12.0 |
| `peniko` | 0.6.1 | 0.6.1 (matches) |

When porting against a specific API, check out the tag egui actually pins, or
port against `main` and accept the drift - the public API surface used here is
stable across these bumps.

### Known gap: font enumeration

`fontique` enumerates system fonts via `fontconfig`/`CoreText`/`DirectWrite`.
Node cannot rely on those, and `egui_system_fonts` is out of scope for this
port. The `fontique` replacement therefore ships a filesystem scanner plus
explicit font registration; a GUI embedding it must supply its own
`FontProvider`.

## Conventions

### Naming

Rust's `snake_case` is kept verbatim, including the leading-underscore methods
that avoid Rust keywords (`_impl`, `_mut`). This makes the port greppable
against upstream: `grep -r "scale_from_center" crates/ packages/` should hit
both sides.

The exceptions:

| Rust | TypeScript | Why |
|---|---|---|
| `impl Trait for T` | `trait` methods on the class | TS classes have no trait impls |
| `Self` | `this`, or the class name in statics | |
| `Option<T>` | `T \| undefined` / `T \| null` | mirrors Rust's two idioms |
| `self` by value (Copy) | **returns a new instance** | see below |
| `x..=y` | two arguments: `lerp(x, y, t)` | no range literals in JS |

### Rust `Copy` semantics

This is the subtlest difference, and getting it wrong silently corrupts shared
state.

Rust's `Pos2`, `Vec2`, `Align2`, `Rect` etc. are `Copy`. So `let a = b; a.x = 0;`
leaves `b` untouched, and `self.with_x(v)` mutates a private copy.

TypeScript has references, so a method that takes `self` **must return a new
instance**:

```ts
// Rust: `fn with_x(mut self, x: Align) -> Self`
// Rust's `Align2` is `Copy`, so this cannot affect the caller's value.
with_x(x: Align): Align2 {
  return new Align2(x, this[1]); // not `this[0] = x; return this`
}
```

This matters for the shared constants: `Align2.LEFT_TOP` and the twelve
`RectAlign::MENU_ALIGNS` are singletons. A mutating `with_x` would corrupt
them permanently. There is a regression test for this in
`packages/emath/src/align.test.ts`.

Mutating methods (`extend_with`, `set_center`, `add_assign`) stay mutating,
because their Rust counterparts take `&mut self`.

### Operators

Rust operator impls become named methods with the same operand semantics:

| Rust | TypeScript |
|---|---|
| `a + b`, `a += b` | `a.add(b)`, `a.add_assign(b)` |
| `a - b`, `a -= b` | `a.sub(b)`, `a.sub_assign(b)` |
| `-a` | `a.neg()` |
| `a * b` (elem-wise), `a * s` (scalar) | `a.mul(b \| s)` - overloaded |
| `a / b`, `a / s` | `a.div(b \| s)` - overloaded |
| `rot * v` | `rot.mul(v)` |
| `a \| b` (union) | `a.union(b)`, `a.union_assign(b)` |

`Rot2::mul` and `TSTransform::mul` are overloaded across several operand types,
matching the Rust impls exactly.

### Panics

Rust `panic!` becomes a thrown `Error`. `f32::clamp` asserts `min <= max`, so
`f32Clamp` throws `RangeError` on an inverted range rather than silently
returning something arbitrary.

`Index` out of bounds panics in Rust; `Vec2::get(i)` / `Pos2::get(i)` /
`Vec2b::get(i)` / `Align2::get(i)` throw `RangeError` past index 1.

## Float semantics

This is where a naive port silently changes behaviour. `emath` is written
against `f32`, whose primitives are **not** the ECMAScript ones.

`packages/emath/src/f32util.ts` centralises the differences:

| Operation | Rust | `Math` | Shim |
|---|---|---|---|
| `f32::min` | NaN → returns the *other* operand | NaN propagates | `f32Min` |
| `f32::max` | NaN → returns the *other* operand | NaN propagates | `f32Max` |
| `f32::round` | half **away from zero** | half **toward +inf** | `f32Round` |
| `f32::clamp` | asserts `min <= max` | `Math.min/max` chain | `f32Clamp` |
| `f32::signum` | preserves sign of zero | — | `f32Signum` |

The rounding one bites hardest: `Math.round(-1.5)` is `-1`, but Rust
`(-1.5f32).round()` is `-2`. Any port using `Math.round` will produce visibly
wrong negative-half rounding in layout and hit-testing.

### Precision

`emath` stores `f32`; JavaScript numbers are `f64`. **This port stores `f64`.**

Values agree with the Rust crate to well under a pixel. The one place a
difference can surface is text layout, which is quantised to font pixels
anyway. If bit-exact `f32` is ever required, wrap the arithmetic in
`Math.fround`; the shim module is the single place to do that.

## Faithfulness vs. correctness

Where the Rust source is buggy, **we port the bug** and add a test that pins
the behaviour, so the two implementations agree and the divergence is visible
rather than discovered later.

Currently pinned:

- **`emath::easing::sin_in` / `sin_out`.** `sin_in(t) = sin((t-1) * 2 * PI) + 1`
  and `sin_out(t) = sin(t * 2 * PI)`. The reference curves on
  <https://easings.net> use a `PI / 2` factor. With `2 * PI` the argument
  sweeps a full period over `[0, 1]`, so both oscillate over a complete cycle
  instead of easing. (`sin_in_out` is correct.) See the test
  `upstream quirk: sin_in/sin_out oscillate instead of easing`.

Known cosmetic divergence, accepted: Rust's `{:.N}` float formatting rounds
ties to even, JS `toFixed` rounds half up. This only affects `Debug` strings.

### Verifying numeric ports

The Bézier flattening tests in `epaint` assert *exact point counts* at a range
of tolerances (`packages/epaint/src/bezier.test.ts`), ported verbatim from the
Rust suite. That turns out to be a strong fingerprint for the flattening
algorithm: bounding boxes can agree while the flattening is subtly wrong.

It immediately caught a transcription error - `approx_parabola_integral` uses
two nested square roots (`sqrt(sqrt(...))`) and one was dropped, which shifted
every count by a few points.

## Deliberately not ported

- **`ecolor::cint_impl`** (`crates/ecolor/src/cint_impl.rs`, behind the `cint`
  feature). Conversions to and from the external `cint` crate's types
  (`Alpha<EncodedSrgb<u8>>`, `Hsv`, `LinearSrgb`, ...). This is interop with a
  specific Rust colour-typing crate; there is no TypeScript equivalent and no
  consumer for it. Analogous to `mint` in `emath`.
- **`ecolor::hex_color!`** (`crates/ecolor/src/hex_color_macro.rs`). A proc macro
  that validates a hex string literal at compile time. TypeScript's equivalent
  is a template literal type, but a usable one cannot be written: TS expands
  `` `#${H}${H}${H}` `` into the full cross product (≈2.6e10 members for the
  3/4/6/8-digit union) and fails with `TS2590: Expression produces a union type
  that is too complex to represent` before it ever checks a call site. So
  `hex_color()` validates at runtime and throws with a helpful message. See the
  comment on `hex_color` for the full reasoning.
- **`ecolor::Rgba`'s `Hash` impl** and `f32_hash`. Rust needs a hashable key;
  the ported classes are used as plain values.
- **`emath::numeric::Numeric`** (`crates/emath/src/numeric.rs`). A trait
  abstracting over the integer and float primitives so that generic code can
  convert to/from `f64`. TypeScript has a single numeric type, so there is
  nothing to abstract. Note that `packages/emath/src/numeric.ts` holds the
  scalar helpers from `emath/src/lib.rs` (`lerp`, `remap`, ...), not this trait.
- **`emath::Real` / `emath::One`**, same reason.
- **Serde derives.** Rust structs derive `Serialize`/`Deserialize`. The ported
  classes are plain objects with public fields, so they are already
  JSON-serialisable; unit enums became string unions (`Align = 'Min' | ...`),
  which matches how serde serialises them. If a schema is needed later, a
  `serde`-compatible adapter is the way.
- **Deprecated methods** (`Rect::flip`, `Align::flip`, `Align2::flip_x`,
  `RectAlign::flip`, ...). Rust keeps these as `#[deprecated]` aliases of a
  renamed method. The port only has the new name.
- **`Debug`/`Display` formatting for most types.** `Display` (`toString`) is
  implemented where it is useful for logging; `Debug` only on the geometry
  types, as `toDebug(precision?)`.

## Tests

Rust unit tests and doctests are ported rather than rewritten, so they keep
their original assertions and stay comparable to upstream. Doc-tests that read
as prose in Rust become fenced code blocks in the JSDoc, which is what the
doc-tests were already written as.

```bash
npm test         # vitest
npm run build    # tsc --build
npm run typecheck
```

## Build

npm workspaces + TypeScript project references. `tsc --build` emits ESM plus
`.d.ts` and source maps into each package's `dist/`. Strict mode, including
`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.