/** Collection tag: products in this collection can be paid with CBM (restricted) points first. */
export const CBM_COLLECTION = 'CBM';

export function isCbmCollectionProduct(collections: string[] | null | undefined): boolean {
  return Array.isArray(collections) && collections.includes(CBM_COLLECTION);
}

export type PointsBalancesJson = {
  universal: number;
  restricted: number;
  total: number;
};

/** Mirrors checkout RPC: CBM bucket applied to CBM-collection subtotal first, then universal for the rest. */
export function allocateCheckoutSpend(
  totalPoints: number,
  eligiblePoints: number,
  restrictedBalance: number,
  universalBalance: number
): { restrictedSpend: number; universalSpend: number; canAfford: boolean } {
  const restrictedSpend = Math.min(restrictedBalance, eligiblePoints);
  const universalSpend = totalPoints - restrictedSpend;
  const canAfford = universalBalance >= universalSpend;
  return { restrictedSpend, universalSpend, canAfford };
}

export function parsePointsBalancesRpc(data: unknown): PointsBalancesJson {
  const parsed =
    typeof data === 'string'
      ? (JSON.parse(data) as PointsBalancesJson)
      : (data as PointsBalancesJson | null);
  return {
    universal: Number(parsed?.universal ?? 0),
    restricted: Number(parsed?.restricted ?? 0),
    total: Number(parsed?.total ?? 0),
  };
}
