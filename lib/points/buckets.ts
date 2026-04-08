/** Collection tag that marks products spendable with CBM (restricted) points */
export const AFFINITY_COLLECTION = 'Affinity';

export function isAffinityProduct(collections: string[] | null | undefined): boolean {
  return Array.isArray(collections) && collections.includes(AFFINITY_COLLECTION);
}

export type PointsBalancesJson = {
  universal: number;
  restricted: number;
  total: number;
};

/** Mirrors checkout RPC: CBM bucket applied to Affinity-eligible subtotal first, then universal for the rest. */
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
