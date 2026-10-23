/**
 * Whether a product's variants can all be bought, the way the product page offers them.
 *
 * As soon as a product has any variant with a size and any with a color, the page asks for
 * one of each and only a variant carrying both can be chosen (AddToCartButton). A size-only
 * or color-only variant on such a product can never reach a cart. Custom variants, with
 * neither, are picked by name and always can.
 */

export interface VariantDimensions {
  name?: string | null;
  size?: string | null;
  color?: string | null;
}

const clean = (value?: string | null) => (value ?? '').trim();

type Shape = 'both' | 'size' | 'color' | 'custom';

function shape(variant: VariantDimensions): Shape {
  const size = clean(variant.size);
  const color = clean(variant.color);
  if (size && color) return 'both';
  if (size) return 'size';
  if (color) return 'color';
  return 'custom';
}

/** How many of these variants the product page could never offer. */
export function unchoosableVariantCount(variants: VariantDimensions[]): number {
  const hasSizes = variants.some((v) => clean(v.size));
  const hasColors = variants.some((v) => clean(v.color));
  if (!hasSizes || !hasColors) return 0;
  return variants.filter((v) => shape(v) === 'size' || shape(v) === 'color').length;
}

function sameVariant(a: VariantDimensions, b: VariantDimensions): boolean {
  const same = (x?: string | null, y?: string | null) => clean(x).toLowerCase() === clean(y).toLowerCase();
  if (shape(a) !== shape(b)) return false;
  if (shape(a) === 'custom') return same(a.name, b.name);
  return same(a.size, b.size) && same(a.color, b.color);
}

function describe(variant: VariantDimensions): string {
  return shape(variant) === 'custom'
    ? `"${clean(variant.name)}"`
    : [clean(variant.size), clean(variant.color)].filter(Boolean).join(' / ');
}

/**
 * Why `candidate` can't be saved alongside `others` (the product's other variants), or null
 * when it can. Only what the candidate itself would break is refused, so a product already
 * in a bad state can still be put right one variant at a time.
 */
export function variantConflict(others: VariantDimensions[], candidate: VariantDimensions): string | null {
  if (others.some((other) => sameVariant(other, candidate))) {
    return `This product already has a ${describe(candidate)} variant.`;
  }

  if (unchoosableVariantCount([...others, candidate]) > unchoosableVariantCount(others)) {
    const candidateShape = shape(candidate);
    if (candidateShape === 'size' || candidateShape === 'color') {
      return `Customers choose a size and a color together on this product, so this variant needs a ${
        candidateShape === 'size' ? 'color' : 'size'
      } as well.`;
    }
    return "This product's other variants have only a size or only a color, and customers could no longer choose them once one has both. Give them both first, or leave this one with just the one.";
  }

  return null;
}
