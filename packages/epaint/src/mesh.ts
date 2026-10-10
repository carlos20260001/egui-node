/**
 * Port of `epaint/src/mesh.rs`.
 *
 * Rust has a second `Vertex` definition behind the `unity` feature that reorders
 * the fields. That is a layout detail for one specific backend and is not
 * reproduced here; `Vertex` always uses the default field order.
 */

import { Pos2, Rect, Rot2, TSTransform, Vec2 } from '@egui-node/emath';
import { Color32 } from '@egui-node/ecolor';

import { DEFAULT_TEXTURE_ID, WHITE_UV } from './texture_id.js';
import type { TextureId } from './texture_id.js';

/**
 * The 2D vertex type.
 *
 * Should be friendly to send to GPU as is.
 */
export class Vertex {
  /** Logical pixel coordinates (points). (0,0) is the top left corner of the screen. */
  pos: Pos2;

  /** Normalized texture coordinates. (0,0) is top-left, (1,1) is bottom-right. */
  uv: Pos2;

  /** sRGBA with premultiplied alpha. */
  color: Color32;

  constructor(pos: Pos2, uv: Pos2, color: Color32) {
    this.pos = pos;
    this.uv = uv;
    this.color = color;
  }

  /** An untextured vertex. */
  static untextured(pos: Pos2, color: Color32): Vertex {
    return new Vertex(pos, WHITE_UV, color);
  }
}

/**
 * A mesh.
 *
 * Rust constructs these with a struct literal, so the constructor accepts
 * optional `vertices` and `indices` to keep call sites readable.
 */
export class Mesh {
  /**
   * Draw as triangles (i.e. the length is always a multiple of three).
   *
   * egui is NOT consistent with what winding order it uses, so turn off backface
   * culling.
   */
  indices: number[];

  /** The vertex data indexed by `indices`. */
  vertices: Vertex[];

  /** The texture to use when drawing these triangles. */
  texture_id: TextureId;

  constructor(texture_id: TextureId = DEFAULT_TEXTURE_ID, vertices: Vertex[] = [], indices: number[] = []) {
    this.indices = indices;
    this.vertices = vertices;
    this.texture_id = texture_id;
  }

  static with_texture(texture_id: TextureId): Mesh {
    return new Mesh(texture_id);
  }

  /** Restore to default state. */
  clear(): void {
    this.indices = [];
    this.vertices = [];
  }

  /**
   * Returns the amount of memory used by the vertices and indices.
   *
   * NOTE: Rust returns a byte count via `size_of`. There is no meaningful JS
   * equivalent (objects have hidden classes, arrays are heap-allocated), so this
   * reports an approximate element count instead. Callers wanting real memory
   * usage should measure differently.
   */
  bytes_used(): number {
    return this.vertices.length + this.indices.length;
  }

  /** Are all indices within the bounds of the contained vertices? */
  is_valid(): boolean {
    const n = this.vertices.length;
    // Rust checks `u32::try_from(len)` first; JS arrays can exceed that, but an
    // index beyond u32 would be meaningless for the GPU anyway.
    if (n > 0xffffffff) {
      return false;
    }
    return this.indices.every((i) => i < n);
  }

  is_empty(): boolean {
    return this.indices.length === 0 && this.vertices.length === 0;
  }

  /** Iterate over the triangles of this mesh, returning vertex indices. */
  triangles(): [number, number, number][] {
    const out: [number, number, number][] = [];
    // `chunks_exact` silently drops a trailing partial triangle.
    for (let i = 0; i + 2 < this.indices.length; i += 3) {
      out.push([this.indices[i]!, this.indices[i + 1]!, this.indices[i + 2]!]);
    }
    return out;
  }

  /** Calculate a bounding rectangle. */
  calc_bounds(): Rect {
    const bounds = Rect.NOTHING.clone();
    for (const v of this.vertices) {
      bounds.extend_with(v.pos);
    }
    return bounds;
  }

  /**
   * Append all the indices and vertices of `other` to `self`.
   *
   * @throws when `other` has a different texture.
   */
  append(other: Mesh): void {
    if (this.is_empty()) {
      this.texture_id = other.texture_id;
      this.indices = [...other.indices];
      this.vertices = [...other.vertices];
    } else {
      this.append_ref(other);
    }
  }

  /**
   * Append all the indices and vertices of `other` to `self`.
   *
   * @throws when `other` has a different texture.
   */
  append_ref(other: Mesh): void {
    if (this.is_empty()) {
      this.texture_id = other.texture_id;
    } else if (
      this.texture_id.kind !== other.texture_id.kind ||
      this.texture_id.id !== other.texture_id.id
    ) {
      throw new Error("Can't merge Mesh using different textures");
    }

    const index_offset = this.vertices.length;
    for (const index of other.indices) {
      this.indices.push(index + index_offset);
    }
    for (const v of other.vertices) {
      this.vertices.push(v);
    }
  }

  /** Add a colored vertex. */
  colored_vertex(pos: Pos2, color: Color32): void {
    this.vertices.push(Vertex.untextured(pos, color));
  }

  /** Add a triangle. */
  add_triangle(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  /** Make room for this many additional triangles (reserves 3x as many indices). */
  reserve_triangles(additional_triangles: number): void {
    // A no-op hint in JS; the array grows on demand.
    void additional_triangles;
  }

  /** Make room for this many additional vertices. */
  reserve_vertices(additional: number): void {
    void additional;
  }

  /** Rectangle with a texture and color. */
  add_rect_with_uv(rect: Rect, uv: Rect, color: Color32): void {
    const idx = this.vertices.length;
    this.indices.push(idx + 0, idx + 1, idx + 2, idx + 2, idx + 1, idx + 3);

    this.vertices.push(
      new Vertex(rect.left_top(), uv.left_top(), color),
      new Vertex(rect.right_top(), uv.right_top(), color),
      new Vertex(rect.left_bottom(), uv.left_bottom(), color),
      new Vertex(rect.right_bottom(), uv.right_bottom(), color),
    );
  }

  /** Uniformly colored rectangle. */
  add_colored_rect(rect: Rect, color: Color32): void {
    const uv = Rect.from_min_max(WHITE_UV, WHITE_UV);
    this.add_rect_with_uv(rect, uv, color);
  }

  /** Transform all vertices in place. */
  transform(transform: TSTransform): void {
    for (const v of this.vertices) {
      v.pos = transform.mul_pos(v.pos);
    }
  }

  /** Translate all vertices in place. */
  translate(delta: Vec2): void {
    for (const v of this.vertices) {
      v.pos = v.pos.add(delta);
    }
  }

  /** Rotate all vertices in place around `origin`. */
  rotate(rot: Rot2, origin: Pos2): void {
    for (const v of this.vertices) {
      v.pos = origin.add(rot.mul(v.pos.sub(origin)));
    }
  }

  clone(): Mesh {
    const m = new Mesh(this.texture_id);
    m.indices = [...this.indices];
    m.vertices = this.vertices.map((v) => new Vertex(v.pos, v.uv, v.color));
    return m;
  }

  equals(other: Mesh): boolean {
    if (
      this.indices.length !== other.indices.length ||
      this.vertices.length !== other.vertices.length
    ) {
      return false;
    }
    for (let i = 0; i < this.indices.length; i++) {
      if (this.indices[i] !== other.indices[i]) return false;
    }
    for (let i = 0; i < this.vertices.length; i++) {
      const a = this.vertices[i]!;
      const b = other.vertices[i]!;
      if (!a.pos.equals(b.pos) || !a.uv.equals(b.uv) || !a.color.equals(b.color)) return false;
    }
    return (
      this.texture_id.kind === other.texture_id.kind && this.texture_id.id === other.texture_id.id
    );
  }
}