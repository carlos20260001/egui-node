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
| `epaint` | 19177 | **in progress** - 29 tests |
| `egui` | 59582 | pending |
| `egui_extras` | 6188 | pending |
| others | — | out of scope (see above) |

`epaint` progress, of 19k lines:

| Module | Lines | Status |
|---|---:|---|
| `margin`, `margin_f32` | 567 | done |
| `corner_radius`, `corner_radius_f32` | 544 | done |
| `stroke`, `color` | 292 | done |
| `brush`, `TextureId` | ~100 | done |
| `rounded_rect`, `shapes/*` | ~2400 | pending |
| `mesh` | 359 | pending |
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
| unit enum | `type T = 'A' \| 'B'` + named consts | `Align`, `StrokeKind` |
| enum with a single field | `{kind: 'A', value: V}` union | `ColorMode`, `TextureId` |
| `struct` of fields | `class` with public fields | `Color32`, `Stroke`, `Margin` |

`ColorMode` and `TextureId` are the middle case. `ColorMode::UV` holds an
`Arc<dyn Fn>`; Rust hand-writes its `PartialEq` so that two closures are never
equal, which `colorModeEquals` reproduces.

### `u32::from_be_bytes`

Several places build a hex number out of byte components. In JS that overflows
`Number.MAX_SAFE_INTEGER` once a full byte lands at the top, so those use `>>>`
and explicit `& 0xff` masking to stay in 32-bit space.

### `let x = ...x...`

Rust shadows freely (`let h = (h.fract() + 1.0).fract();`). In JavaScript that
is a temporal-dead-zone error, so shadowed locals get a new name. This was a real
bug caught by the tests in `rgb_from_hsv`.

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