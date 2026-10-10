/**
 * Port of `emath/src/rect_align.rs`.
 */

import { Align2 } from './align.js';
import { Pos2 } from './pos2.js';
import { Rect } from './rect.js';
import { Vec2 } from './vec2.js';

/**
 * Position a child {@link Rect} relative to a parent {@link Rect}.
 *
 * The corner from {@link RectAlign.child} on the new rect will be aligned to
 * the corner from {@link RectAlign.parent} on the original rect.
 *
 * There are helper constants for the 12 common menu positions:
 * ```text
 *              ┌───────────┐  ┌────────┐  ┌─────────┐
 *              │ TOP_START │  │  TOP   │  │ TOP_END │
 *              └───────────┘  └────────┘  └─────────┘
 * ┌──────────┐ ┌────────────────────────────────────┐ ┌───────────┐
 * │LEFT_START│ │                                    │ │RIGHT_START│
 * └──────────┘ │                                    │ └───────────┘
 * ┌──────────┐ │                                    │ ┌───────────┐
 * │   LEFT   │ │             some_rect              │ │   RIGHT   │
 * └──────────┘ │                                    │ └───────────┘
 * ┌──────────┐ │                                    │ ┌───────────┐
 * │ LEFT_END │ │                                    │ │ RIGHT_END │
 * └──────────┘ └────────────────────────────────────┘ └───────────┘
 *              ┌────────────┐  ┌──────┐  ┌──────────┐
 *              │BOTTOM_START│  │BOTTOM│  │BOTTOM_END│
 *              └────────────┘  └──────┘  └──────────┘
 * ```
 *
 * There is no `new`-style convenience on purpose, since writing out `parent`
 * and `child` is more reasonable.
 */
export class RectAlign {
  /** The alignment in the parent (original) rect. */
  readonly parent: Align2;

  /** The alignment in the child (new) rect. */
  readonly child: Align2;

  constructor(parent: Align2, child: Align2) {
    this.parent = parent;
    this.child = child;
  }

  /** Along the top edge, leftmost. */
  static readonly TOP_START: RectAlign = new RectAlign(Align2.LEFT_TOP, Align2.LEFT_BOTTOM);
  /** Along the top edge, centered. */
  static readonly TOP: RectAlign = new RectAlign(Align2.CENTER_TOP, Align2.CENTER_BOTTOM);
  /** Along the top edge, rightmost. */
  static readonly TOP_END: RectAlign = new RectAlign(Align2.RIGHT_TOP, Align2.RIGHT_BOTTOM);

  /** Along the right edge, topmost. */
  static readonly RIGHT_START: RectAlign = new RectAlign(Align2.RIGHT_TOP, Align2.LEFT_TOP);
  /** Along the right edge, centered. */
  static readonly RIGHT: RectAlign = new RectAlign(Align2.RIGHT_CENTER, Align2.LEFT_CENTER);
  /** Along the right edge, bottommost. */
  static readonly RIGHT_END: RectAlign = new RectAlign(Align2.RIGHT_BOTTOM, Align2.LEFT_BOTTOM);

  /** Along the bottom edge, rightmost. */
  static readonly BOTTOM_END: RectAlign = new RectAlign(Align2.RIGHT_BOTTOM, Align2.RIGHT_TOP);
  /** Along the bottom edge, centered. */
  static readonly BOTTOM: RectAlign = new RectAlign(Align2.CENTER_BOTTOM, Align2.CENTER_TOP);
  /** Along the bottom edge, leftmost. */
  static readonly BOTTOM_START: RectAlign = new RectAlign(Align2.LEFT_BOTTOM, Align2.LEFT_TOP);

  /** Along the left edge, bottommost. */
  static readonly LEFT_END: RectAlign = new RectAlign(Align2.LEFT_BOTTOM, Align2.RIGHT_BOTTOM);
  /** Along the left edge, centered. */
  static readonly LEFT: RectAlign = new RectAlign(Align2.LEFT_CENTER, Align2.RIGHT_CENTER);
  /** Along the left edge, topmost. */
  static readonly LEFT_START: RectAlign = new RectAlign(Align2.LEFT_TOP, Align2.RIGHT_TOP);

  /**
   * The 12 most common menu positions, for use with
   * {@link RectAlign.find_best_align}.
   */
  static readonly MENU_ALIGNS: readonly RectAlign[] = [
    RectAlign.BOTTOM_START,
    RectAlign.BOTTOM_END,
    RectAlign.TOP_START,
    RectAlign.TOP_END,
    RectAlign.RIGHT_END,
    RectAlign.RIGHT_START,
    RectAlign.LEFT_END,
    RectAlign.LEFT_START,
    // These come last on purpose, we prefer the corner ones
    RectAlign.TOP,
    RectAlign.RIGHT,
    RectAlign.BOTTOM,
    RectAlign.LEFT,
  ];

  /** Align in the parent rect. */
  parent_align(): Align2 {
    return this.parent;
  }

  /** Align in the child rect. */
  child_align(): Align2 {
    return this.child;
  }

  /** Convert an {@link Align2} to a {@link RectAlign}, positioning the child inside the parent. */
  static from_align2(align: Align2): RectAlign {
    return new RectAlign(align, align);
  }

  /** The center of the child rect will be aligned to a corner of the parent rect. */
  static over_corner(align: Align2): RectAlign {
    return new RectAlign(align, Align2.CENTER_CENTER);
  }

  /** Position the child rect outside the parent rect. */
  static outside(align: Align2): RectAlign {
    return new RectAlign(align, align.flipped());
  }

  /** Calculate the child rect based on a size and some optional gap. */
  align_rect(parent_rect: Rect, size: Vec2, gap: number): Rect {
    const [pivot, anchor] = this.pivot_pos(parent_rect, gap);
    return pivot.anchor_size(anchor, size);
  }

  /**
   * Returns an {@link Align2} and a {@link Pos2} that you can e.g. use with
   * `Area::fixed_pos` and `Area::pivot` to align an `Area` to some rect.
   */
  pivot_pos(parent_rect: Rect, gap: number): [Align2, Pos2] {
    return [this.child, this.anchor(parent_rect, gap)];
  }

  /**
   * Returns a sign vector (-1, 0 or 1 in each direction) that can be used as an
   * offset to the child rect, creating a gap between the rects while keeping
   * the edges aligned.
   */
  gap_vector(): Vec2 {
    const gap = this.child.to_sign().neg();

    // Align the edges in these cases.
    if (
      this.is(RectAlign.TOP_START) ||
      this.is(RectAlign.TOP_END) ||
      this.is(RectAlign.BOTTOM_START) ||
      this.is(RectAlign.BOTTOM_END)
    ) {
      gap.x = 0.0;
    } else if (
      this.is(RectAlign.LEFT_START) ||
      this.is(RectAlign.LEFT_END) ||
      this.is(RectAlign.RIGHT_START) ||
      this.is(RectAlign.RIGHT_END)
    ) {
      gap.y = 0.0;
    }

    return gap;
  }

  /**
   * Calculate the anchor point for the child rect, based on the parent rect and
   * an optional gap.
   */
  anchor(parent_rect: Rect, gap: number): Pos2 {
    const pos = this.parent.pos_in_rect(parent_rect);
    const offset = this.gap_vector().mul(gap);
    return pos.add(offset);
  }

  /** Flip the alignment on the x-axis. */
  flipped_x(): RectAlign {
    return new RectAlign(this.parent.flipped_x(), this.child.flipped_x());
  }

  /** Flip the alignment on the y-axis. */
  flipped_y(): RectAlign {
    return new RectAlign(this.parent.flipped_y(), this.child.flipped_y());
  }

  /** Flip the alignment on both axes. */
  flipped(): RectAlign {
    return new RectAlign(this.parent.flipped(), this.child.flipped());
  }

  /**
   * Returns the 3 alternative {@link RectAlign}s that are flipped in various
   * ways, for use with {@link RectAlign.find_best_align}.
   */
  symmetries(): [RectAlign, RectAlign, RectAlign] {
    return [this.flipped_x(), this.flipped_y(), this.flipped()];
  }

  /**
   * Look for the first alternative {@link RectAlign} that allows the child rect
   * to fit inside the `content_rect`.
   *
   * If no alternative fits, the first is returned.
   * If no alternatives are given, `null` is returned.
   *
   * See also:
   * - {@link RectAlign.symmetries} to calculate alternatives
   * - {@link RectAlign.MENU_ALIGNS} for the 12 common menu positions
   */
  static find_best_align(
    values_to_try: Iterable<RectAlign>,
    content_rect: Rect,
    parent_rect: Rect,
    gap: number,
    expected_size: Vec2,
  ): RectAlign | null {
    let first_choice: RectAlign | null = null;

    for (const align of values_to_try) {
      // Remember the first alternative
      first_choice = first_choice ?? align;

      const suggested_popup_rect = align.align_rect(parent_rect, expected_size, gap);

      if (content_rect.contains_rect(suggested_popup_rect)) {
        return align;
      }
    }

    return first_choice;
  }

  /** Compare against one of the named constants (`RectAlign::TOP_START` etc.). */
  is(other: RectAlign): boolean {
    return this.parent.equals(other.parent) && this.child.equals(other.child);
  }

  clone(): RectAlign {
    return new RectAlign(this.parent.clone(), this.child.clone());
  }

  equals(other: RectAlign): boolean {
    return this.is(other);
  }

  toString(): string {
    return `RectAlign { parent: ${this.parent}, child: ${this.child} }`;
  }
}