/**
 * Port of `epaint/src/brush.rs`.
 */

import { Rect } from '@egui-node/emath';
import { DEFAULT_TEXTURE_ID } from './texture_id.js';
import type { TextureId } from './texture_id.js';

/**
 * Controls texturing of a `RectShape`.
 *
 * This is a plain `Copy` struct of two fields, so unlike `Margin` and
 * `CornerRadius` the class is only there to group the fields.
 */
export class Brush {
  /**
   * If the rect should be filled with a texture, which one?
   *
   * The texture is multiplied with `RectShape::fill`.
   */
  fill_texture_id: TextureId;

  /**
   * What UV coordinates to use for the texture?
   *
   * To display a texture, set `fill_texture_id`, and set this to
   * `Rect::from_min_max(pos2(0.0, 0.0), pos2(1.0, 1.0))`.
   *
   * Use `Rect.ZERO` to turn off texturing.
   */
  uv: Rect;

  constructor(fill_texture_id: TextureId = DEFAULT_TEXTURE_ID, uv: Rect = Rect.ZERO) {
    this.fill_texture_id = fill_texture_id;
    this.uv = uv;
  }

  clone(): Brush {
    return new Brush(this.fill_texture_id, this.uv);
  }

  equals(other: Brush): boolean {
    return this.uv.equals(other.uv) && this.fill_texture_id.kind === other.fill_texture_id.kind &&
      this.fill_texture_id.id === other.fill_texture_id.id;
  }

  toString(): string {
    return `Brush { fill_texture_id: ${this.fill_texture_id.kind}(${this.fill_texture_id.id}), uv: ${this.uv} }`;
  }
}