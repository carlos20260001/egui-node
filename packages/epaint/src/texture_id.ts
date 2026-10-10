/**
 * Port of the `TextureId` and `WHITE_UV` definitions in `epaint/src/lib.rs`.
 */

import { Pos2, pos2 } from '@egui-node/emath';

/**
 * A UV coordinate that maps to a flat white texture.
 *
 * The four white texels are arranged so that a fragment lands on exactly one
 * of them (so it doesn't do bilinear blending with the bottom right corner).
 */
export const WHITE_UV: Pos2 = pos2(0.0, 0.0);

/**
 * What texture to use in a `Mesh`.
 *
 * If you don't want to use a texture, use `TextureId.managed(0)` and the
 * {@link WHITE_UV} for uv-coord.
 *
 * A Rust enum with `Managed(u64)` and `User(u64)` variants. Modelled as a
 * discriminated union.
 */
export type TextureId = ManagedTextureId | UserTextureId;

export interface ManagedTextureId {
  readonly kind: 'Managed';
  readonly id: bigint;
}

export interface UserTextureId {
  readonly kind: 'User';
  readonly id: bigint;
}

/**
 * Textures allocated using the `TextureManager`.
 *
 * The first texture (`managed(0)`) is used for the font data.
 */
export function managed(id: number | bigint): ManagedTextureId {
  return { kind: 'Managed', id: BigInt(id) };
}

/** Your own texture, defined in any which way you want. */
export function user(id: number | bigint): UserTextureId {
  return { kind: 'User', id: BigInt(id) };
}

/** The default, which is the epaint font texture. */
export const DEFAULT_TEXTURE_ID: ManagedTextureId = managed(0);

/** `TextureId::default()`, i.e. `Managed(0)`. */
export function defaultTextureId(): ManagedTextureId {
  return DEFAULT_TEXTURE_ID;
}

/**
 * Rust derives `PartialOrd`/`Ord` on this enum, which orders by variant
 * discriminant first (`Managed` before `User`) and then by the inner id.
 */
export function compareTextureId(a: TextureId, b: TextureId): number {
  if (a.kind !== b.kind) {
    return a.kind === 'Managed' ? -1 : 1;
  }
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function textureIdEquals(a: TextureId, b: TextureId): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export function textureIdDebug(t: TextureId): string {
  return `${t.kind}(${t.id})`;
}

/** `True` for the default (font) texture, used to mean "no texture". */
export function isDefaultTextureId(t: TextureId): boolean {
  return t.kind === 'Managed' && t.id === 0n;
}