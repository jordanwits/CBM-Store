/**
 * Which picture goes with a chosen variant.
 *
 * The product page has always swapped its gallery on colour (ImageGallery), but the cart,
 * checkout and order pages each reached straight for products.images[0], so a customer who
 * picked Red saw the line read "Red" next to the cover photo of the black one. The image
 * has to be resolved the same way everywhere, which is what this is for.
 *
 * The fallback runs variant, then colour sibling, then cover photo, because how a variant
 * carries its image depends on which admin flow built it. VariantMatrixBuilder stamps the
 * colour's image onto every size combination, so the chosen variant usually has its own.
 * Variants added one at a time through VariantManager often do not: the image may sit on
 * only one of the sizes in that colour, or on a colour-only variant with the sizes added
 * separately. Falling back through the colour catches those without asking the store to go
 * back and fill in every combination.
 */

export interface VariantImageSource {
  color?: string | null;
  image_url?: string | null;
}

function cleaned(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Colours are typed by hand in the admin, so "Navy" and "navy " are the same colour. */
function colorKey(value: string | null | undefined): string | null {
  return cleaned(value)?.toLowerCase() ?? null;
}

export function resolveVariantImage(
  productImages: readonly (string | null | undefined)[] | null | undefined,
  variant?: VariantImageSource | null,
  productVariants?: readonly VariantImageSource[] | null
): string | undefined {
  const own = cleaned(variant?.image_url);
  if (own) return own;

  const wantedColor = colorKey(variant?.color);
  if (wantedColor && productVariants) {
    for (const sibling of productVariants) {
      if (colorKey(sibling.color) !== wantedColor) continue;
      const siblingImage = cleaned(sibling.image_url);
      if (siblingImage) return siblingImage;
    }
  }

  for (const image of productImages || []) {
    const cover = cleaned(image);
    if (cover) return cover;
  }

  return undefined;
}
