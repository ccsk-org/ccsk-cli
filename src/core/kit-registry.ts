/**
 * Kit registry — metadata for available kits and their repos.
 *
 * Pricing copy is computed at render time from Supabase `payment-config`
 * (`lifetime_price_vnd`), not stored here. That keeps a single source of truth
 * for price and lets the operator re-price all paid kits from the Supabase
 * dashboard without a CLI release. See `formatKitPrice()` below.
 */

export interface KitMeta {
  id: string;
  label: string;
  repo: string;
  pricing: 'free' | 'paid';
  description: string;
  /** Released kits are installable. Unreleased kits show "(coming soon)" and refuse install. */
  comingSoon: boolean;
  /**
   * Offline fallback only. `fetchKit` resolves the *current* latest from the
   * kit repo at install time (gh release → git ls-remote). This value is used
   * solely when both resolution paths fail, so a totally offline user can still
   * install a known-shipped version.
   */
  defaultVersion: string;
}

export const KIT_REGISTRY: KitMeta[] = [
  {
    id: 'common',
    label: 'Common Kit',
    repo: 'ccsk-org/common-kit',
    pricing: 'free',
    description: 'Base Claude Code configuration, ready to ship',
    comingSoon: false,
    defaultVersion: '1.0.0',
  },
  {
    id: 'frontend',
    label: 'Frontend Workflows Kit',
    repo: 'ccsk-org/frontend-kit',
    pricing: 'paid',
    description: 'Fully-powered Claude Code config + ship-ready workflows',
    comingSoon: false,
    defaultVersion: '1.0.0',
  },
  {
    id: 'backend',
    label: 'Backend Workflows Kit',
    repo: 'ccsk-org/backend-kit',
    pricing: 'paid',
    description: 'Battle-ready API + service workflows for Node.js, Python, Go',
    comingSoon: true,
    defaultVersion: '1.0.0',
  },
  {
    id: 'mobile',
    label: 'Mobile Workflows Kit',
    repo: 'ccsk-org/mobile-kit',
    pricing: 'paid',
    description: 'Cross-platform mobile workflows for React Native and Flutter',
    comingSoon: true,
    defaultVersion: '1.0.0',
  },
];

export function getKitMeta(id: string): KitMeta | undefined {
  return KIT_REGISTRY.find((k) => k.id === id);
}

export function getEnabledKits(): KitMeta[] {
  return KIT_REGISTRY.filter((k) => !k.comingSoon);
}

export function isKitEnabled(id: string): boolean {
  const kit = getKitMeta(id);
  return Boolean(kit && !kit.comingSoon);
}

/**
 * Right-column price/status copy for the kit picker. Free kits ignore the
 * Supabase price; paid kits format it via `vi-VN` locale (e.g. `265.000`).
 * Coming-soon paid kits show the future price with a "(coming soon)" suffix.
 */
export function formatKitPrice(kit: KitMeta, lifetimePriceVnd: number): string {
  if (kit.pricing === 'free') return 'Free forever';
  const price = `${lifetimePriceVnd.toLocaleString('vi-VN')} VND / Lifetime`;
  return kit.comingSoon ? `${price} (coming soon)` : price;
}
