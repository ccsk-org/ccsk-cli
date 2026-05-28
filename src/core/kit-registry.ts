/**
 * Kit registry — metadata for available kits and their repos.
 * Kits are fetched from private GitHub repos, not bundled.
 */

export interface KitMeta {
  id: string;
  label: string;
  repo: string;
  pricing: 'free' | 'paid';
  description: string;
  defaultVersion: string;
}

export const KIT_REGISTRY: KitMeta[] = [
  {
    id: 'common',
    label: 'Common',
    repo: 'imnortheastt/ccsk-common-kit',
    pricing: 'free',
    description: 'Base Claude Code configuration — always free',
    defaultVersion: '1.0.0',
  },
  {
    id: 'frontend',
    label: 'Frontend',
    repo: 'imnortheastt/ccsk-frontend-kit',
    pricing: 'paid',
    description: 'React/Next.js frontend kit with UI/UX patterns',
    defaultVersion: '1.0.0',
  },
  {
    id: 'backend',
    label: 'Backend',
    repo: 'imnortheastt/ccsk-backend-kit',
    pricing: 'paid',
    description: 'Node.js/Python backend kit — coming soon',
    defaultVersion: '1.0.0',
  },
  {
    id: 'mobile',
    label: 'Mobile',
    repo: 'imnortheastt/ccsk-mobile-kit',
    pricing: 'paid',
    description: 'React Native/Flutter mobile kit — coming soon',
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
