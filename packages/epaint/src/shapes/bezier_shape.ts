/**
 * Port of `epaint/src/shapes/bezier_shape.rs`.
 *
 * The flattening algorithm is Raph Levien's, ported from `lyon_geom`. See
 * <https://raphlinus.github.io/graphics/curves/2019/12/23/flatten-quadbez.html>
 */

import { Pos2, Rect, RectTransform, fast_midpoint } from '@egui-node/emath';
import { Color32 } from '@egui-node/ecolor';

import { PathShape } from './path_shape.js';
import { PathStroke } from '../stroke.js';

/** A cubic [Bézier curve](https://en.wikipedia.org/wiki/B%C3%A9zier_curve). */
export class CubicBezierShape {
  /**
   * The first point is the starting point and the last one is the ending point
   * of the curve. The middle points are the control points.
   */
  points: [Pos2, Pos2, Pos2, Pos2];
  closed: boolean;
  fill: Color32;
  stroke: PathStroke;

  constructor(points: [Pos2, Pos2, Pos2, Pos2], closed: boolean, fill: Color32, stroke: PathStroke) {
    this.points = points;
    this.closed = closed;
    this.fill = fill;
    this.stroke = stroke;
  }

  static from_points_stroke(
    points: [Pos2, Pos2, Pos2, Pos2],
    closed: boolean,
    fill: Color32,
    stroke: PathStroke,
  ): CubicBezierShape {
    return new CubicBezierShape(points, closed, fill, stroke);
  }

  /** Transform the curve with the given transform. */
  transform(transform: RectTransform): CubicBezierShape {
    const points = this.points.map((p) => transform.mul(p)) as [Pos2, Pos2, Pos2, Pos2];
    return new CubicBezierShape(points, this.closed, this.fill, this.stroke);
  }

  /**
   * Convert the cubic Bézier curve to one or two `PathShape`s.
   *
   * When the curve is closed and it has to intersect with the base line, it
   * will be converted into two shapes. Otherwise, one shape. `tolerance`
   * controls the max distance between the curve and the base line; `epsilon`
   * is used when comparing two floats.
   */
  to_path_shapes(tolerance?: number, epsilon?: number): PathShape[] {
    return this.flatten_closed(tolerance, epsilon).map(
      (points) => new PathShape(points, this.closed, this.fill, this.stroke),
    );
  }

  /** The visual bounding rectangle (includes stroke width). */
  visual_bounding_rect(): Rect {
    if (this.fill.equals(Color32.TRANSPARENT) && this.stroke.is_empty()) {
      return Rect.NOTHING;
    }
    return this.logical_bounding_rect().expand(this.stroke.width * 0.5);
  }

  /** Logical bounding rectangle (ignoring stroke width). */
  logical_bounding_rect(): Rect {
    // temporary solution
    let [min_x, max_x] =
      this.points[0].x < this.points[3].x
        ? [this.points[0].x, this.points[3].x]
        : [this.points[3].x, this.points[0].x];
    let [min_y, max_y] =
      this.points[0].y < this.points[3].y
        ? [this.points[0].y, this.points[3].y]
        : [this.points[3].y, this.points[0].y];

    // find the inflection points and get the x value
    cubic_for_each_local_extremum(
      this.points[0].x,
      this.points[1].x,
      this.points[2].x,
      this.points[3].x,
      (t) => {
        const x = this.sample(t).x;
        if (x < min_x) min_x = x;
        if (x > max_x) max_x = x;
      },
    );

    // find the inflection points and get the y value
    cubic_for_each_local_extremum(
      this.points[0].y,
      this.points[1].y,
      this.points[2].y,
      this.points[3].y,
      (t) => {
        const y = this.sample(t).y;
        if (y < min_y) min_y = y;
        if (y > max_y) max_y = y;
      },
    );

    return Rect.from_min_max(new Pos2(min_x, min_y), new Pos2(max_x, max_y));
  }

  /** Split the original cubic curve into a new one within a range. */
  split_range(t_start: number, t_end: number): CubicBezierShape {
    if (!(0.0 <= t_start && t_end <= 1.0 && t_start <= t_end)) {
      throw new RangeError('split_range: range should be in [0.0, 1.0]');
    }

    const from = this.sample(t_start);
    const to = this.sample(t_end);

    const d_from = this.points[1].sub(this.points[0].to_vec2());
    const d_ctrl = this.points[2].sub(this.points[1].to_vec2());
    const d_to = this.points[3].sub(this.points[2].to_vec2());
    const q = new QuadraticBezierShape(
      [d_from as Pos2, d_ctrl as Pos2, d_to as Pos2],
      this.closed,
      this.fill,
      this.stroke,
    );
    const delta_t = t_end - t_start;
    const q_start = q.sample(t_start);
    const q_end = q.sample(t_end);
    const ctrl1 = from.add(q_start.to_vec2().mul(delta_t));
    const ctrl2 = to.sub(q_end.to_vec2().mul(delta_t));

    return new CubicBezierShape([from, ctrl1, ctrl2, to], this.closed, this.fill, this.stroke);
  }

  /**
   * Computes the number of quadratic Bézier segments needed to approximate this
   * cubic one.
   *
   * Copied from `lyon_geom`, derived by Raph Levien from section 10.6 of
   * Sedeberg's CAGD notes.
   */
  num_quadratics(tolerance: number): number {
    if (!(tolerance > 0.0)) {
      throw new RangeError('num_quadratics: the tolerance should be positive');
    }

    const x = this.points[0].x - 3.0 * this.points[1].x + 3.0 * this.points[2].x - this.points[3].x;
    const y = this.points[0].y - 3.0 * this.points[1].y + 3.0 * this.points[2].y - this.points[3].y;
    const err = x * x + y * y;

    return Math.max(Math.ceil(Math.pow(err / (432.0 * tolerance * tolerance), 1.0 / 6.0)), 1.0);
  }

  /**
   * Find the t value (if any) in the open interval `(epsilon, 1 - epsilon)`
   * where the curve crosses its base line, i.e. the line from P0 to P3.
   *
   * If the curve only touches the base line at its end points (t = 0 and
   * t = 1), the "fill" is simple since the curve is convex, and `undefined` is
   * returned. If the curve crosses the base line once more in between, we
   * return that t so the curve can be split into two curves.
   *
   * The (scaled) signed distance from the base line is
   * `f(t) = cross(B(t) - P0, P3 - P0)`, a cubic polynomial in t. Since
   * `f(0) = 0` and `f(1) = 0`, we have `b = -(a + c)`, so
   * `f(t) = a*t*(t - 1)*(t - c/a)`, and the only interesting root is `t = c/a`.
   */
  find_cross_t(epsilon: number): number | undefined {
    const [p0, p1, p2, p3] = this.points;

    const a =
      (p3.x - 3.0 * p2.x + 3.0 * p1.x - p0.x) * (p3.y - p0.y) -
      (p3.y - 3.0 * p2.y + 3.0 * p1.y - p0.y) * (p3.x - p0.x);
    const c = 3.0 * ((p1.x - p0.x) * (p3.y - p0.y) - (p1.y - p0.y) * (p3.x - p0.x));

    // t=0 and t=1 are always roots, so the cubic is a*t*(t-1)*(t - c/a).
    // If a == 0 we get inf or NaN, which fails the range check below.
    const t = c / a;
    return epsilon < t && t < 1.0 - epsilon ? t : undefined;
  }

  /**
   * Calculate the point (x,y) at t based on the cubic Bézier curve equation.
   * t is in [0.0, 1.0].
   */
  sample(t: number): Pos2 {
    if (!(t >= 0.0 && t <= 1.0)) {
      throw new RangeError('sample: the sample value should be in [0.0, 1.0]');
    }

    const h = 1.0 - t;
    const a = t * t * t;
    const b = 3.0 * t * t * h;
    const c = 3.0 * t * h * h;
    const d = h * h * h;
    const result = this.points[3]
      .to_vec2()
      .mul(a)
      .add(this.points[2].to_vec2().mul(b))
      .add(this.points[1].to_vec2().mul(c))
      .add(this.points[0].to_vec2().mul(d));
    return result.to_pos2();
  }

  /**
   * Find a set of points that approximate the cubic Bézier curve. The number of
   * points is determined by the tolerance. The points may not be evenly
   * distributed in the range [0.0, 1.0] (t value).
   */
  flatten(tolerance?: number): Pos2[] {
    const tol = tolerance ?? Math.abs(this.points[0].x - this.points[3].x) * 0.001;
    const result: Pos2[] = [this.points[0]];
    this.for_each_flattened_with_t(tol, (p) => {
      result.push(p);
    });
    return result;
  }

  /**
   * Like {@link CubicBezierShape.flatten}, but checks whether the curve crosses
   * the base line when `closed = true`. The result is a list of lists: a curve
   * that crosses produces two closed areas in separate lists.
   */
  flatten_closed(tolerance?: number, epsilon?: number): Pos2[][] {
    const tol = tolerance ?? Math.abs(this.points[0].x - this.points[3].x) * 0.001;
    const eps = epsilon ?? 1.0e-5;
    const result: Pos2[][] = [];
    const first_half: Pos2[] = [];
    const second_half: Pos2[] = [];
    let flipped = false;
    first_half.push(this.points[0]);

    const cross = this.find_cross_t(eps);
    if (cross !== undefined) {
      if (this.closed) {
        this.for_each_flattened_with_t(tol, (p, t) => {
          if (t < cross) {
            first_half.push(p);
          } else {
            if (!flipped) {
              // When we just crossed the base line, flip the order of the points,
              // add the cross point to the first half as the last point and to
              // the second half as the first point.
              flipped = true;
              const cross_point = this.sample(cross);
              first_half.push(cross_point);
              second_half.push(cross_point);
            }
            second_half.push(p);
          }
        });
      } else {
        this.for_each_flattened_with_t(tol, (p) => {
          first_half.push(p);
        });
      }
    } else {
      this.for_each_flattened_with_t(tol, (p) => {
        first_half.push(p);
      });
    }

    result.push(first_half);
    if (second_half.length !== 0) {
      result.push(second_half);
    }
    return result;
  }

  /** Iterates through the curve, invoking a callback at each point with its `t`. */
  for_each_flattened_with_t(tolerance: number, callback: (p: Pos2, t: number) => void): void {
    flatten_cubic_bezier_with_t(this, tolerance, callback);
  }

  clone(): CubicBezierShape {
    return new CubicBezierShape([...this.points] as [Pos2, Pos2, Pos2, Pos2], this.closed, this.fill, this.stroke);
  }

  equals(other: CubicBezierShape): boolean {
    return (
      this.points.every((p, i) => p.equals(other.points[i]!)) &&
      this.closed === other.closed &&
      this.fill.equals(other.fill) &&
      this.stroke.equals(other.stroke)
    );
  }
}

/** A quadratic [Bézier curve](https://en.wikipedia.org/wiki/B%C3%A9zier_curve). */
export class QuadraticBezierShape {
  /**
   * The first point is the starting point and the last one is the ending point
   * of the curve. The middle point is the control point.
   *
   * The points should be in the order `[start, control, end]`.
   */
  points: [Pos2, Pos2, Pos2];
  closed: boolean;
  fill: Color32;
  stroke: PathStroke;

  constructor(points: [Pos2, Pos2, Pos2], closed: boolean, fill: Color32, stroke: PathStroke) {
    this.points = points;
    this.closed = closed;
    this.fill = fill;
    this.stroke = stroke;
  }

  static from_points_stroke(
    points: [Pos2, Pos2, Pos2],
    closed: boolean,
    fill: Color32,
    stroke: PathStroke,
  ): QuadraticBezierShape {
    return new QuadraticBezierShape(points, closed, fill, stroke);
  }

  /** Transform the curve with the given transform. */
  transform(transform: RectTransform): QuadraticBezierShape {
    const points = this.points.map((p) => transform.mul(p)) as [Pos2, Pos2, Pos2];
    return new QuadraticBezierShape(points, this.closed, this.fill, this.stroke);
  }

  /** Convert the quadratic Bézier curve to one `PathShape`. */
  to_path_shape(tolerance?: number): PathShape {
    return new PathShape(this.flatten(tolerance), this.closed, this.fill, this.stroke);
  }

  /** The visual bounding rectangle (includes stroke width). */
  visual_bounding_rect(): Rect {
    if (this.fill.equals(Color32.TRANSPARENT) && this.stroke.is_empty()) {
      return Rect.NOTHING;
    }
    return this.logical_bounding_rect().expand(this.stroke.width * 0.5);
  }

  /** Logical bounding rectangle (ignoring stroke width). */
  logical_bounding_rect(): Rect {
    let [min_x, max_x] =
      this.points[0].x < this.points[2].x
        ? [this.points[0].x, this.points[2].x]
        : [this.points[2].x, this.points[0].x];
    let [min_y, max_y] =
      this.points[0].y < this.points[2].y
        ? [this.points[0].y, this.points[2].y]
        : [this.points[2].y, this.points[0].y];

    quadratic_for_each_local_extremum(this.points[0].x, this.points[1].x, this.points[2].x, (t) => {
      const x = this.sample(t).x;
      if (x < min_x) min_x = x;
      if (x > max_x) max_x = x;
    });

    quadratic_for_each_local_extremum(this.points[0].y, this.points[1].y, this.points[2].y, (t) => {
      const y = this.sample(t).y;
      if (y < min_y) min_y = y;
      if (y > max_y) max_y = y;
    });

    return Rect.from_min_max(new Pos2(min_x, min_y), new Pos2(max_x, max_y));
  }

  /**
   * Calculate the point (x,y) at t based on the quadratic Bézier curve
   * equation. t is in [0.0, 1.0].
   */
  sample(t: number): Pos2 {
    if (!(t >= 0.0 && t <= 1.0)) {
      throw new RangeError('sample: the sample value should be in [0.0, 1.0]');
    }

    const h = 1.0 - t;
    const a = t * t;
    const b = 2.0 * t * h;
    const c = h * h;
    const result = this.points[2]
      .to_vec2()
      .mul(a)
      .add(this.points[1].to_vec2().mul(b))
      .add(this.points[0].to_vec2().mul(c));
    return result.to_pos2();
  }

  /** Find a set of points that approximate the quadratic Bézier curve. */
  flatten(tolerance?: number): Pos2[] {
    const tol = tolerance ?? Math.abs(this.points[0].x - this.points[2].x) * 0.001;
    const result: Pos2[] = [this.points[0]];
    this.for_each_flattened_with_t(tol, (p) => {
      result.push(p);
    });
    return result;
  }

  /**
   * Compute a flattened approximation of the curve, invoking a callback at each
   * step with the point and corresponding curve parameter.
   *
   * This implements the algorithm described by Raph Levien at
   * <https://raphlinus.github.io/graphics/curves/2019/12/23/flatten-quadbez.html>
   */
  for_each_flattened_with_t(tolerance: number, callback: (p: Pos2, t: number) => void): void {
    const params = FlatteningParameters.from_curve(this, tolerance);
    if (params.is_point) {
      return;
    }

    const count = Math.trunc(params.count);
    for (let index = 1; index < count; index++) {
      const t = params.t_at_iteration(index);
      callback(this.sample(t), t);
    }

    callback(this.sample(1.0), 1.0);
  }

  clone(): QuadraticBezierShape {
    return new QuadraticBezierShape([...this.points] as [Pos2, Pos2, Pos2], this.closed, this.fill, this.stroke);
  }

  equals(other: QuadraticBezierShape): boolean {
    return (
      this.points.every((p, i) => p.equals(other.points[i]!)) &&
      this.closed === other.closed &&
      this.fill.equals(other.fill) &&
      this.stroke.equals(other.stroke)
    );
  }
}

// ----------------------------------------------------------------------------
// lyon_geom::flatten_cubic.rs
// ----------------------------------------------------------------------------

function flatten_cubic_bezier_with_t(
  curve: CubicBezierShape,
  tolerance: number,
  callback: (p: Pos2, t: number) => void,
): void {
  const quadratics_tolerance = tolerance * 0.2;
  const flattening_tolerance = tolerance * 0.8;

  const num_quadratics = curve.num_quadratics(quadratics_tolerance);
  const step = 1.0 / num_quadratics;
  const n = num_quadratics;
  let t0 = 0.0;
  for (let i = 0; i < n - 1; i++) {
    const t1 = t0 + step;

    const quadratic = single_curve_approximation(curve.split_range(t0, t1));
    quadratic.for_each_flattened_with_t(flattening_tolerance, (point, t_sub) => {
      const t = t0 + step * t_sub;
      callback(point, t);
    });

    t0 = t1;
  }

  // Do the last step manually to make sure we finish at t = 1.0 exactly.
  const quadratic = single_curve_approximation(curve.split_range(t0, 1.0));
  quadratic.for_each_flattened_with_t(flattening_tolerance, (point, t_sub) => {
    const t = t0 + step * t_sub;
    callback(point, t);
  });
}

// ----------------------------------------------------------------------------
// lyon_geom::quadratic_bezier.rs
// ----------------------------------------------------------------------------

class FlatteningParameters {
  count: number;
  integral_from: number;
  integral_step: number;
  inv_integral_from: number;
  div_inv_integral_diff: number;
  is_point: boolean;

  constructor(
    count: number,
    integral_from: number,
    integral_step: number,
    inv_integral_from: number,
    div_inv_integral_diff: number,
    is_point: boolean,
  ) {
    this.count = count;
    this.integral_from = integral_from;
    this.integral_step = integral_step;
    this.inv_integral_from = inv_integral_from;
    this.div_inv_integral_diff = div_inv_integral_diff;
    this.is_point = is_point;
  }

  static from_curve(curve: QuadraticBezierShape, tolerance: number): FlatteningParameters {
    // Map the quadratic Bézier segment to y = x^2 parabola.
    const from = curve.points[0];
    const ctrl = curve.points[1];
    const to = curve.points[2];

    const ddx = 2.0 * ctrl.x - from.x - to.x;
    const ddy = 2.0 * ctrl.y - from.y - to.y;
    const cross = (to.x - from.x) * ddy - (to.y - from.y) * ddx;
    const inv_cross = 1.0 / cross;
    const parabola_from = ((ctrl.x - from.x) * ddx + (ctrl.y - from.y) * ddy) * inv_cross;
    const parabola_to = ((to.x - ctrl.x) * ddx + (to.y - ctrl.y) * ddy) * inv_cross;
    // Note, scale can be NaN, for example with straight lines. When it happens
    // the NaN will propagate to other parameters. We catch it all by setting
    // the iteration count to zero and leave the rest as garbage.
    const scale = Math.abs(cross) / (Math.hypot(ddx, ddy) * Math.abs(parabola_to - parabola_from));

    const integral_from = approx_parabola_integral(parabola_from);
    const integral_to = approx_parabola_integral(parabola_to);
    const integral_diff = integral_to - integral_from;

    const inv_integral_from = approx_parabola_inv_integral(integral_from);
    const inv_integral_to = approx_parabola_inv_integral(integral_to);
    const div_inv_integral_diff = 1.0 / (inv_integral_to - inv_integral_from);

    // The original author thinks `count` can be stored as an integer if it's not
    // generic, but then the edge case of the integral being infinite has to be
    // handled.
    let count = Math.ceil(0.5 * Math.abs(integral_diff) * Math.sqrt(scale / tolerance));
    let is_point = false;
    // If count is NaN the curve can be approximated by a single straight line or a point.
    if (!Number.isFinite(count)) {
      count = 0.0;
      is_point = Math.hypot(to.x - from.x, to.y - from.y) < tolerance * tolerance;
    }

    const integral_step = integral_diff / count;

    return new FlatteningParameters(
      count,
      integral_from,
      integral_step,
      inv_integral_from,
      div_inv_integral_diff,
      is_point,
    );
  }

  t_at_iteration(iteration: number): number {
    const u = approx_parabola_inv_integral(this.integral_from + this.integral_step * iteration);
    return (u - this.inv_integral_from) * this.div_inv_integral_diff;
  }
}

/**
 * Compute an approximation to the integral (1 + 4x^2) ^ -0.25 dx used in the
 * flattening code.
 */
function approx_parabola_integral(x: number): number {
  const d = 0.67;
  const quarter = 0.25;
  // NB: two nested square roots, i.e. `sqrt(sqrt(...))`.
  return x / (1.0 - d + Math.sqrt(Math.sqrt(Math.pow(d, 4) + quarter * x * x)));
}

/** Approximate the inverse of the function above. */
function approx_parabola_inv_integral(x: number): number {
  const b = 0.39;
  const quarter = 0.25;
  return x * (1.0 - b + Math.sqrt(b * b + quarter * x * x));
}

function single_curve_approximation(curve: CubicBezierShape): QuadraticBezierShape {
  const c1_x = (curve.points[1].x * 3.0 - curve.points[0].x) * 0.5;
  const c1_y = (curve.points[1].y * 3.0 - curve.points[0].y) * 0.5;
  const c2_x = (curve.points[2].x * 3.0 - curve.points[3].x) * 0.5;
  const c2_y = (curve.points[2].y * 3.0 - curve.points[3].y) * 0.5;
  const c = new Pos2(fast_midpoint(c1_x, c2_x), fast_midpoint(c1_y, c2_y));
  return new QuadraticBezierShape(
    [curve.points[0], c, curve.points[3]],
    curve.closed,
    curve.fill,
    curve.stroke,
  );
}

function quadratic_for_each_local_extremum(p0: number, p1: number, p2: number, cb: (t: number) => void): void {
  // A quadratic Bézier curve can be derived by a linear function:
  //   p(t) = p0 + t(p1 - p0) + t^2(p2 - 2p1 + p0)
  // The derivative is:
  //   p'(t) = (p1 - p0) + 2(p2 - 2p1 + p0)t
  const a = p2 - 2.0 * p1 + p0;
  // No need to check for zero, since we're only interested in local extrema.
  if (a === 0.0) {
    return;
  }

  const t = (p0 - p1) / a;
  if (t > 0.0 && t < 1.0) {
    cb(t);
  }
}

function cubic_for_each_local_extremum(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  cb: (t: number) => void,
): void {
  // See www.faculty.idc.ac.il/arik/quality/appendixa.html for an explanation.
  //   B'(t) = 3(1-t)^2(p1-p0) + 6(1-t)t(p2-p1) + 3t^2(p3-p2)
  // i.e. f(x) = a*x^2 + b*x + c
  const a = 3.0 * (p3 + 3.0 * (p1 - p2) - p0);
  const b = 6.0 * (p2 - 2.0 * p1 + p0);
  const c = 3.0 * (p1 - p0);

  const in_range = (t: number) => t <= 1.0 && t >= 0.0;

  // linear situation
  if (a === 0.0) {
    if (b !== 0.0) {
      const t = -c / b;
      if (in_range(t)) {
        cb(t);
      }
    }
    return;
  }

  const discr = b * b - 4.0 * a * c;
  // no real solution
  if (discr < 0.0) {
    return;
  }

  // one real solution
  if (discr === 0.0) {
    const t = -b / (2.0 * a);
    if (in_range(t)) {
      cb(t);
    }
    return;
  }

  // two real solutions
  const root = Math.sqrt(discr);
  const t1 = (-b - root) / (2.0 * a);
  const t2 = (-b + root) / (2.0 * a);
  if (in_range(t1)) {
    cb(t1);
  }
  if (in_range(t2)) {
    cb(t2);
  }
}