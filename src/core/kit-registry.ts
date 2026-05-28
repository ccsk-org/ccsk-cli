/**
 * Kit registry — metadata for available kits and their repos.
 * Kits are fetched from private GitHub repos, not bundled.
 */

/**
 * `priceLabel` is display-only copy shown in the kit picker. The real charged
 * amount still comes from Supabase via `payment-config` so pricing stays
 * editable without a CLI release.
 */
export interface KitMeta {
  id: string;
  label: string;
  repo: string;
  pricing: 'free' | 'paid';
  description: string;
  priceLabel: string;
  defaultVersion: string;
}

export const KIT_REGISTRY: KitMeta[] = [
  {
    id: 'common',
    label: 'Common Kit',
    repo: 'ccsk-org/common-kit',
    pricing: 'free',
    description: 'Base Claude Code configuration, ready to ship',
    priceLabel: 'Free forever',
    defaultVersion: '1.0.0',
  },
  {
    id: 'frontend',
    label: 'Frontend Workflows Kit',
    repo: 'ccsk-org/frontend-kit',
    pricing: 'paid',
    description: 'Fully-powered Claude Code config + ship-ready workflows',
    priceLabel: '265,000 VND / Lifetime',
    defaultVersion: '1.0.0',
  },
  {
    id: 'backend',
    label: 'Backend Workflows Kit',
    repo: 'ccsk-org/backend-kit',
    pricing: 'paid',
    description: 'Same scope and price as Frontend — battle-ready APIs and services',
    priceLabel: 'Coming soon',
    defaultVersion: '1.0.0',
  },
  {
    id: 'mobile',
    label: 'Mobile Workflows Kit',
    repo: 'ccsk-org/mobile-kit',
    pricing: 'paid',
    description: 'Same scope and price as Frontend — cross-platform mobile workflows',
    priceLabel: 'Coming soon',
    defaultVersion: '1.0.0',
  },
];

export function getKitMeta(id: string): KitMeta | undefined {
  return KIT_REGISTRY.find((k) => k.id === id);
}

export function getEnabledKits(): KitMeta[] {
  // For now, only common and frontend are enabled
  return KIT_REGISTRY.filter((k) => k.id === 'common' || k.id === 'frontend');
}

export function isKitEnabled(id: string): boolean {
  return id === 'common' || id === 'frontend';
}
