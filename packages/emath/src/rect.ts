/**
 * Port of `emath/src/rect.rs`.
 */

import { Pos2, pos2 } from './pos2.js';
import { Rangef } from './range.js';
import { Rot2 } from './rot2.js';
import { Vec2, vec2 } from './vec2.js';
import { f32Max, f32Min } from './f32util.js';
import { at_least, fast_midpoint, lerp } from './numeric.js';

/**
 * A rectangular region of space.
 *
 * Usually a {@link Rect} has a positive (or zero) size, and then `min <= max`.
 * In these cases `min` is the left-top corner and `max` is the right-bottom
 * corner.
 *
 * A rectangle is allowed to have a negative size, which happens when the order
 * of `min` and `max` are swapped. These are usually a sign of an error.
 *
 * Normally the unit is points (logical pixels) in screen space coordinates.
 */
export class Rect {
  /** One of the corners of the rectangle, usually the left top one. */
  min: Pos2;

  /** The other corner, opposing `min`. Usually the right bottom one. */
  max: Pos2;

  constructor(min: Pos2, max: Pos2) {
    this.min = min;
    this.max = max;
  }

  /** Infinite rectangle that contains every point. */
  static readonly EVERYTHING: Rect = new Rect(
    pos2(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY),
    pos2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
  );

  /**
   * The inverse of {@link Rect.EVERYTHING}: stretches from positive infinity to
   * negative infinity. Contains no points.
   *
   * This is useful as the seed for bounding boxes.
   *
   * ```
   * let rect = Rect.NOTHING;
   * rect.size() == vec2(-inf, -inf)
   * rect.contains(pos2(0, 0)) === false
   * rect.extend_with(pos2(2, 1));
   * rect.extend_with(pos2(0, 3));
   * rect.equals(Rect.from_min_max(pos2(0, 1), pos2(2, 3)))
   * ```
   */
  static readonly NOTHING: Rect = new Rect(
    pos2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
    pos2(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY),
  );

  /** An invalid {@link Rect} filled with NaN. */
  static readonly NAN: Rect = new Rect(pos2(Number.NaN, Number.NaN), pos2(Number.NaN, Number.NaN));

  /** A {@link Rect} filled with zeroes. */
  static readonly ZERO: Rect = new Rect(pos2(0, 0), pos2(0, 0));

  static from_min_max(min: Pos2, max: Pos2): Rect {
    return new Rect(min, max);
  }

  /** `impl From<[Pos2; 2]> for Rect` */
  static fromTuple(v: readonly [Pos2, Pos2]): Rect {
    return new Rect(v[0], v[1]);
  }

  /** left-top corner plus a size (stretching right-down). */
  static from_min_size(min: Pos2, size: Vec2): Rect {
    return new Rect(min, min.add(size));
  }

  static from_center_size(center: Pos2, size: Vec2): Rect {
    return new Rect(center.sub(size.mul(0.5)), center.add(size.mul(0.5)));
  }

  static from_x_y_ranges(x_range: Rangef, y_range: Rangef): Rect {
    return new Rect(pos2(x_range.min, y_range.min), pos2(x_range.max, y_range.max));
  }

  /** Returns the bounding rectangle of the two points. */
  static from_two_pos(a: Pos2, b: Pos2): Rect {
    return new Rect(pos2(f32Min(a.x, b.x), f32Min(a.y, b.y)), pos2(f32Max(a.x, b.x), f32Max(a.y, b.y)));
  }

  /** A zero-sized rect at a specific point. */
  static from_pos(point: Pos2): Rect {
    return new Rect(point, point);
  }

  /** Bounding-box around the points. */
  static from_points(points: readonly Pos2[]): Rect {
    const rect = Rect.NOTHING.clone();
    for (const p of points) {
      rect.extend_with(p);
    }
    return rect;
  }

  /** A {@link Rect} that contains every point to the right of the given X coordinate. */
  static everything_right_of(left_x: number): Rect {
    const rect = Rect.EVERYTHING.clone();
    rect.set_left(left_x);
    return rect;
  }

  /** A {@link Rect} that contains every point to the left of the given X coordinate. */
  static everything_left_of(right_x: number): Rect {
    const rect = Rect.EVERYTHING.clone();
    rect.set_right(right_x);
    return rect;
  }

  /** A {@link Rect} that contains every point below a certain y coordinate. */
  static everything_below(top_y: number): Rect {
    const rect = Rect.EVERYTHING.clone();
    rect.set_top(top_y);
    return rect;
  }

  /** A {@link Rect} that contains every point above a certain y coordinate. */
  static everything_above(bottom_y: number): Rect {
    const rect = Rect.EVERYTHING.clone();
    rect.set_bottom(bottom_y);
    return rect;
  }

  with_min_x(min_x: number): Rect {
    return new Rect(pos2(min_x, this.min.y), this.max);
  }

  with_min_y(min_y: number): Rect {
    return new Rect(pos2(this.min.x, min_y), this.max);
  }

  with_max_x(max_x: number): Rect {
    return new Rect(this.min, pos2(max_x, this.max.y));
  }

  with_max_y(max_y: number): Rect {
    return new Rect(this.min, pos2(this.max.x, max_y));
  }

  /** Expand by this much in each direction, keeping the center. */
  expand(amnt: number): Rect {
    return this.expand2(Vec2.splat(amnt));
  }

  /** Expand by this much in each direction, keeping the center. */
  expand2(amnt: Vec2): Rect {
    return Rect.from_min_max(this.min.sub(amnt), this.max.add(amnt));
  }

  /** Scale up by this factor in each direction, keeping the center. */
  scale_from_center(scale_factor: number): Rect {
    return this.scale_from_center2(Vec2.splat(scale_factor));
  }

  /** Scale up by this factor in each direction, keeping the center. */
  scale_from_center2(scale_factor: Vec2): Rect {
    return Rect.from_center_size(this.center(), this.size().mul(scale_factor));
  }

  /** Shrink by this much in each direction, keeping the center. */
  shrink(amnt: number): Rect {
    return this.shrink2(Vec2.splat(amnt));
  }

  /** Shrink by this much in each direction, keeping the center. */
  shrink2(amnt: Vec2): Rect {
    return Rect.from_min_max(this.min.add(amnt), this.max.sub(amnt));
  }

  translate(amnt: Vec2): Rect {
    return Rect.from_min_size(this.min.add(amnt), this.size());
  }

  /** Rotate the bounds (will expand the {@link Rect}). */
  rotate_bb(rot: Rot2): Rect {
    const a = rot.mul(this.left_top().to_vec2());
    const b = rot.mul(this.right_top().to_vec2());
    const c = rot.mul(this.left_bottom().to_vec2());
    const d = rot.mul(this.right_bottom().to_vec2());

    return Rect.from_min_max(
      a.min(b).min(c).min(d).to_pos2(),
      a.max(b).max(c).max(d).to_pos2(),
    );
  }

  intersects(other: Rect): boolean {
    return (
      this.min.x <= other.max.x && other.min.x <= this.max.x && this.min.y <= other.max.y && other.min.y <= this.max.y
    );
  }

  /** keep min */
  set_width(w: number): void {
    this.max.x = this.min.x + w;
  }

  /** keep min */
  set_height(h: number): void {
    this.max.y = this.min.y + h;
  }

  /** Keep size */
  set_center(center: Pos2): void {
    const translated = this.translate(center.sub(this.center()));
    this.min = translated.min;
    this.max = translated.max;
  }

  contains(p: Pos2): boolean {
    return this.min.x <= p.x && p.x <= this.max.x && this.min.y <= p.y && p.y <= this.max.y;
  }

  contains_rect(other: Rect): boolean {
    return this.contains(other.min) && this.contains(other.max);
  }

  /** Return the given points clamped to be inside the rectangle. */
  clamp(p: Pos2): Pos2 {
    return p.clamp(this.min, this.max);
  }

  /** Floor the rect coordinates */
  floor(): Rect {
    return new Rect(this.min.floor(), this.max.floor());
  }

  /** Round the rect coordinates */
  round(): Rect {
    return new Rect(this.min.round(), this.max.round());
  }

  /** Ceil the rect coordinates */
  ceil(): Rect {
    return new Rect(this.min.ceil(), this.max.ceil());
  }

  /**
   * Rounded so that two adjacent rects that tile perfectly
   * will continue to tile perfectly.
   */
  round_ui(): Rect {
    return new Rect(this.min.round_ui(), this.max.round_ui());
  }

  /** See {@link Rect.round_ui}. */
  floor_ui(): Rect {
    return new Rect(this.min.floor_ui(), this.max.floor_ui());
  }

  /** See {@link Rect.round_ui}. */
  round_to_pixels(pixels_per_point: number): Rect {
    return new Rect(this.min.round_to_pixels(pixels_per_point), this.max.round_to_pixels(pixels_per_point));
  }

  /** See {@link Rect.round_ui}. */
  round_to_pixel_center(pixels_per_point: number): Rect {
    return new Rect(
      this.min.round_to_pixel_center(pixels_per_point),
      this.max.round_to_pixel_center(pixels_per_point),
    );
  }

  /** Expand to include the given point */
  extend_with(p: Pos2): void {
    this.min = this.min.min(p);
    this.max = this.max.max(p);
  }

  /** Expand to include the given x coordinate */
  extend_with_x(x: number): void {
    this.min.x = f32Min(this.min.x, x);
    this.max.x = f32Max(this.max.x, x);
  }

  /** Expand to include the given y coordinate */
  extend_with_y(y: number): void {
    this.min.y = f32Min(this.min.y, y);
    this.max.y = f32Max(this.max.y, y);
  }

  /** The union of two bounding rectangle, i.e. the minimum {@link Rect} that contains both. */
  union(other: Rect): Rect {
    return new Rect(this.min.min(other.min), this.max.max(other.max));
  }

  /** The intersection of two {@link Rect}, i.e. the area covered by both. */
  intersect(other: Rect): Rect {
    return new Rect(this.min.max(other.min), this.max.min(other.max));
  }

  center(): Pos2 {
    return pos2(fast_midpoint(this.min.x, this.max.x), fast_midpoint(this.min.y, this.max.y));
  }

  /** `rect.size() == vec2(rect.width(), rect.height())` */
  size(): Vec2 {
    return this.max.sub(this.min);
  }

  /** Note: this can be negative. */
  width(): number {
    return this.max.x - this.min.x;
  }

  /** Note: this can be negative. */
  height(): number {
    return this.max.y - this.min.y;
  }

  /**
   * Width / height
   *
   * * `aspect_ratio < 1`: portrait / high
   * * `aspect_ratio = 1`: square
   * * `aspect_ratio > 1`: landscape / wide
   */
  aspect_ratio(): number {
    return this.width() / this.height();
  }

  /**
   * `vec2(2, 1)` for wide screen, and `vec2(1, 2)` for portrait, etc.
   * At least one dimension = 1, the other >= 1.
   * Returns the proportions required to letter-box a square view area.
   */
  square_proportions(): Vec2 {
    const w = this.width();
    const h = this.height();
    return w > h ? vec2(w / h, 1.0) : vec2(1.0, h / w);
  }

  /** This is never negative, and instead returns zero for negative rectangles. */
  area(): number {
    return at_least(this.width(), 0.0) * at_least(this.height(), 0.0);
  }

  /**
   * The distance from the rect to the position.
   *
   * The distance is zero when the position is in the interior of the rectangle.
   *
   * Negative rectangles always return infinity.
   */
  distance_to_pos(pos: Pos2): number {
    return Math.sqrt(this.distance_sq_to_pos(pos));
  }

  /**
   * The distance from the rect to the position, squared.
   *
   * The distance is zero when the position is in the interior of the rectangle.
   *
   * Negative rectangles always return infinity.
   */
  distance_sq_to_pos(pos: Pos2): number {
    if (this.is_negative()) {
      return Number.POSITIVE_INFINITY;
    }

    const dx = this.min.x > pos.x ? this.min.x - pos.x : pos.x > this.max.x ? pos.x - this.max.x : 0.0;

    const dy = this.min.y > pos.y ? this.min.y - pos.y : pos.y > this.max.y ? pos.y - this.max.y : 0.0;

    return dx * dx + dy * dy;
  }

  /**
   * Signed distance to the edge of the box.
   *
   * Negative inside the box.
   *
   * Negative rectangles always return infinity.
   *
   * ```
   * const rect = Rect.from_min_max(pos2(0, 0), pos2(1, 1));
   * rect.signed_distance_to_pos(pos2(0.50, 0.50)) === -0.50
   * rect.signed_distance_to_pos(pos2(0.75, 0.50)) === -0.25
   * rect.signed_distance_to_pos(pos2(1.50, 0.50)) === 0.50
   * ```
   */
  signed_distance_to_pos(pos: Pos2): number {
    if (this.is_negative()) {
      return Number.POSITIVE_INFINITY;
    }

    const edge_distances = pos.sub(this.center()).abs().sub(this.size().mul(0.5));
    const inside_dist = f32Min(edge_distances.max_elem(), 0.0);
    const outside_dist = edge_distances.max(Vec2.ZERO).length();
    return inside_dist + outside_dist;
  }

  /** Linearly interpolate so that `[0, 0]` is `min` and `[1, 1]` is `max`. */
  lerp_inside(t: Vec2): Pos2 {
    return pos2(lerp(this.min.x, this.max.x, t.x), lerp(this.min.y, this.max.y, t.y));
  }

  /** Linearly interpolate towards another rect. */
  lerp_towards(other: Rect, t: number): Rect {
    return new Rect(this.min.lerp_to(other.min, t), this.max.lerp_to(other.max, t));
  }

  x_range(): Rangef {
    return new Rangef(this.min.x, this.max.x);
  }

  y_range(): Rangef {
    return new Rangef(this.min.y, this.max.y);
  }

  /**
   * The extent along the given axis: `0` for x, `1` for y.
   *
   * @throws if `axis` is not `0` or `1`.
   */
  range_along(axis: number): Rangef {
    switch (axis) {
      case 0:
        return this.x_range();
      case 1:
        return this.y_range();
      default:
        throw new RangeError(`axis must be 0 or 1, got ${axis}`);
    }
  }

  /**
   * The size along the given axis: `0` for x (width), `1` for y (height).
   *
   * @throws if `axis` is not `0` or `1`.
   */
  size_along(axis: number): number {
    return this.size().get(axis);
  }

  bottom_up_range(): Rangef {
    return new Rangef(this.max.y, this.min.y);
  }

  /** `width < 0 || height < 0` */
  is_negative(): boolean {
    return this.max.x < this.min.x || this.max.y < this.min.y;
  }

  /** `width > 0 && height > 0` */
  is_positive(): boolean {
    return this.min.x < this.max.x && this.min.y < this.max.y;
  }

  /** True if all members are also finite. */
  is_finite(): boolean {
    return this.min.is_finite() && this.max.is_finite();
  }

  /** True if any member is NaN. */
  any_nan(): boolean {
    return this.min.any_nan() || this.max.any_nan();
  }

  // --------------------------------------------------------------------------
  // Convenience functions (assumes origin is towards left top)
  // --------------------------------------------------------------------------

  left(): number {
    return this.min.x;
  }

  set_left(x: number): void {
    this.min.x = x;
  }

  right(): number {
    return this.max.x;
  }

  set_right(x: number): void {
    this.max.x = x;
  }

  top(): number {
    return this.min.y;
  }

  set_top(y: number): void {
    this.min.y = y;
  }

  bottom(): number {
    return this.max.y;
  }

  set_bottom(y: number): void {
    this.max.y = y;
  }

  left_top(): Pos2 {
    return pos2(this.left(), this.top());
  }

  center_top(): Pos2 {
    return pos2(this.center().x, this.top());
  }

  right_top(): Pos2 {
    return pos2(this.right(), this.top());
  }

  left_center(): Pos2 {
    return pos2(this.left(), this.center().y);
  }

  right_center(): Pos2 {
    return pos2(this.right(), this.center().y);
  }

  left_bottom(): Pos2 {
    return pos2(this.left(), this.bottom());
  }

  center_bottom(): Pos2 {
    return pos2(this.center().x, this.bottom());
  }

  right_bottom(): Pos2 {
    return pos2(this.right(), this.bottom());
  }

  /** Split rectangle in left and right halves. `t` is expected to be in the (0,1) range. */
  split_left_right_at_fraction(t: number): [Rect, Rect] {
    return this.split_left_right_at_x(lerp(this.min.x, this.max.x, t));
  }

  /** Split rectangle in left and right halves at the given `x` coordinate. */
  split_left_right_at_x(split_x: number): [Rect, Rect] {
    const left = Rect.from_min_max(this.min, pos2(split_x, this.max.y));
    const right = Rect.from_min_max(pos2(split_x, this.min.y), this.max);
    return [left, right];
  }

  /** Split rectangle in top and bottom halves. `t` is expected to be in the (0,1) range. */
  split_top_bottom_at_fraction(t: number): [Rect, Rect] {
    return this.split_top_bottom_at_y(lerp(this.min.y, this.max.y, t));
  }

  /** Split rectangle in top and bottom halves at the given `y` coordinate. */
  split_top_bottom_at_y(split_y: number): [Rect, Rect] {
    const top = Rect.from_min_max(this.min, pos2(this.max.x, split_y));
    const bottom = Rect.from_min_max(pos2(this.min.x, split_y), this.max);
    return [top, bottom];
  }

  // --------------------------------------------------------------------------
  // Rays
  // --------------------------------------------------------------------------

  /**
   * Does this Rect intersect the given ray (where `d` is normalized)?
   *
   * A ray that starts inside the rect will return `true`.
   */
  intersects_ray(o: Pos2, d: Vec2): boolean {
    let tmin = Number.NEGATIVE_INFINITY;
    let tmax = Number.POSITIVE_INFINITY;

    if (d.x !== 0.0) {
      const tx1 = (this.min.x - o.x) / d.x;
      const tx2 = (this.max.x - o.x) / d.x;

      tmin = f32Max(tmin, f32Min(tx1, tx2));
      tmax = f32Min(tmax, f32Max(tx1, tx2));
    }

    if (d.y !== 0.0) {
      const ty1 = (this.min.y - o.y) / d.y;
      const ty2 = (this.max.y - o.y) / d.y;

      tmin = f32Max(tmin, f32Min(ty1, ty2));
      tmax = f32Min(tmax, f32Max(ty1, ty2));
    }

    return 0.0 <= tmax && tmin <= tmax;
  }

  /**
   * Where does a ray from the center intersect the rectangle?
   *
   * `d` is the direction of the ray and assumed to be normalized.
   */
  intersects_ray_from_center(d: Vec2): Pos2 {
    let tmin = Number.NEGATIVE_INFINITY;
    let tmax = Number.POSITIVE_INFINITY;

    const center = this.center();
    for (let i = 0; i < 2; i++) {
      const inv_d = 1.0 / -d.get(i);
      let t0 = (this.min.get(i) - center.get(i)) * inv_d;
      let t1 = (this.max.get(i) - center.get(i)) * inv_d;

      if (inv_d < 0.0) {
        const tmp = t0;
        t0 = t1;
        t1 = tmp;
      }

      tmin = f32Max(tmin, t0);
      tmax = f32Min(tmax, t1);
    }

    const t = f32Min(tmax, tmin);
    return center.add(d.mul(-t));
  }

  // --------------------------------------------------------------------------
  // Operator impls
  // --------------------------------------------------------------------------

  /** `self * factor` */
  mul(factor: number): Rect {
    return new Rect(this.min.mul(factor), this.max.mul(factor));
  }

  /** `self / factor` */
  div(factor: number): Rect {
    return new Rect(this.min.div(factor), this.max.div(factor));
  }

  /** `self | other` - the union (`impl BitOr for Rect`). */
  union_assign(other: Rect): Rect {
    const u = this.union(other);
    this.min = u.min;
    this.max = u.max;
    return this;
  }

  clone(): Rect {
    return new Rect(this.min, this.max);
  }

  equals(other: Rect): boolean {
    return this.min.equals(other.min) && this.max.equals(other.max);
  }

  /** Rust's `impl fmt::Display for Rect`. */
  toString(): string {
    return `[${this.min} - ${this.max}]`;
  }

  /** Rust's `impl fmt::Debug for Rect`. */
  toDebug(precision?: number): string {
    const p = precision ?? 1;
    return `[${this.min.toDebug(p)} - ${this.max.toDebug(p)}]`;
  }
}

/** `impl Mul<Rect> for f32` */
export function scalarMulRect(factor: number, rect: Rect): Rect {
  return new Rect(rect.min.mul(factor), rect.max.mul(factor));
}