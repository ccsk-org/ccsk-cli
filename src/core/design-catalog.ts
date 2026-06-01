export interface DesignEntry {
  slug: string;
  name: string;
  desc: string;
  category: string;
}

export const DESIGNS: DesignEntry[] = [
  // AI & LLM Platforms
  { slug: 'claude',       name: 'Claude',       category: 'AI & LLM Platforms',       desc: "Anthropic's AI assistant. Warm terracotta accent, clean editorial layout." },
  { slug: 'cursor',       name: 'Cursor',       category: 'AI & LLM Platforms',       desc: 'AI-first code editor. Sleek dark interface, gradient accents.' },
  { slug: 'lovable',      name: 'Lovable',      category: 'AI & LLM Platforms',       desc: 'AI full-stack builder. Playful gradients, friendly dev aesthetic.' },
  { slug: 'minimax',      name: 'MiniMax',      category: 'AI & LLM Platforms',       desc: 'AI model provider. Bold dark interface with neon accents.' },
  { slug: 'mistral.ai',   name: 'Mistral AI',   category: 'AI & LLM Platforms',       desc: 'Open-weight LLM provider. French-engineered minimalism, purple-toned.' },
  { slug: 'cohere',       name: 'Cohere',       category: 'AI & LLM Platforms',       desc: 'Enterprise AI platform. Vibrant gradients, data-rich dashboard aesthetic.' },
  { slug: 'elevenlabs',   name: 'ElevenLabs',   category: 'AI & LLM Platforms',       desc: 'AI voice platform. Dark cinematic UI, audio-waveform aesthetics.' },
  { slug: 'together.ai',  name: 'Together AI',  category: 'AI & LLM Platforms',       desc: 'Open-source AI infrastructure. Technical, blueprint-style design.' },
  { slug: 'nvidia',       name: 'NVIDIA',       category: 'AI & LLM Platforms',       desc: 'GPU computing. Green-black energy, technical power aesthetic.' },
  { slug: 'ollama',       name: 'Ollama',       category: 'AI & LLM Platforms',       desc: 'Run LLMs locally. Terminal-first, monochrome simplicity.' },
  { slug: 'x.ai',         name: 'xAI',          category: 'AI & LLM Platforms',       desc: 'Grok AI platform. Bold sans-serif, high-contrast monochrome.' },
  { slug: 'replicate',    name: 'Replicate',    category: 'AI & LLM Platforms',       desc: 'Run ML models in the cloud. Clean developer aesthetic.' },
  { slug: 'runwayml',     name: 'Runway',       category: 'AI & LLM Platforms',       desc: 'AI video generation. Cinematic dark UI, media-rich layout.' },

  // Developer Tools & IDEs
  { slug: 'vercel',       name: 'Vercel',       category: 'Developer Tools & IDEs',   desc: 'Frontend deployment. Black and white precision, Geist font.' },
  { slug: 'expo',         name: 'Expo',         category: 'Developer Tools & IDEs',   desc: 'React Native platform. Dark theme, tight letter-spacing, code-centric.' },
  { slug: 'mintlify',     name: 'Mintlify',     category: 'Developer Tools & IDEs',   desc: 'Documentation platform. Clean, green-accented, reading-optimized.' },
  { slug: 'composio',     name: 'Composio',     category: 'Developer Tools & IDEs',   desc: 'Tool integration platform. Modern dark with colorful integration icons.' },
  { slug: 'warp',         name: 'Warp',         category: 'Developer Tools & IDEs',   desc: 'AI-powered terminal. Dark, fast, developer-focused.' },
  { slug: 'raycast',      name: 'Raycast',      category: 'Developer Tools & IDEs',   desc: 'Developer productivity launcher. Clean, extensible, keyboard-first.' },
  { slug: 'opencode.ai',  name: 'OpenCode',     category: 'Developer Tools & IDEs',   desc: 'AI coding platform. Developer-centric dark theme.' },
  { slug: 'cal',          name: 'Cal.com',      category: 'Developer Tools & IDEs',   desc: 'Open-source scheduling. Clean neutral UI, developer-oriented simplicity.' },
  { slug: 'voltagent',    name: 'VoltAgent',    category: 'Developer Tools & IDEs',   desc: 'AI agent framework. Open-source, TypeScript-first.' },
  { slug: 'resend',       name: 'Resend',       category: 'Developer Tools & IDEs',   desc: 'Email API for developers. Clean minimal, code-first.' },

  // Backend, Database & DevOps
  { slug: 'supabase',     name: 'Supabase',     category: 'Backend, Database & DevOps', desc: 'Open-source Firebase alternative. Dark emerald theme, code-first.' },
  { slug: 'mongodb',      name: 'MongoDB',      category: 'Backend, Database & DevOps', desc: 'Document database. Green leaf branding, developer documentation focus.' },
  { slug: 'clickhouse',   name: 'ClickHouse',   category: 'Backend, Database & DevOps', desc: 'Fast analytics database. Yellow-accented, technical documentation style.' },
  { slug: 'hashicorp',    name: 'HashiCorp',    category: 'Backend, Database & DevOps', desc: 'Infrastructure automation. Enterprise-clean, black and white.' },
  { slug: 'ibm',          name: 'IBM',          category: 'Backend, Database & DevOps', desc: 'Enterprise technology. Carbon design system, structured blue palette.' },
  { slug: 'sanity',       name: 'Sanity',       category: 'Backend, Database & DevOps', desc: 'Headless CMS. Red accent, content-first editorial layout.' },
  { slug: 'sentry',       name: 'Sentry',       category: 'Backend, Database & DevOps', desc: 'Error monitoring. Dark dashboard, data-dense, pink-purple accent.' },
  { slug: 'posthog',      name: 'PostHog',      category: 'Backend, Database & DevOps', desc: 'Open-source product analytics. Data-dense, hedgehog branding.' },

  // Productivity & SaaS
  { slug: 'notion',       name: 'Notion',       category: 'Productivity & SaaS',      desc: 'All-in-one workspace. Warm minimalism, serif headings, soft surfaces.' },
  { slug: 'linear.app',   name: 'Linear',       category: 'Productivity & SaaS',      desc: 'Project management. Ultra-minimal, precise, purple accent.' },
  { slug: 'airtable',     name: 'Airtable',     category: 'Productivity & SaaS',      desc: 'Spreadsheet-database hybrid. Colorful, friendly, structured data aesthetic.' },
  { slug: 'slack',        name: 'Slack',        category: 'Productivity & SaaS',      desc: 'Team messaging. Aubergine header, vibrant color, human-first.' },
  { slug: 'miro',         name: 'Miro',         category: 'Productivity & SaaS',      desc: 'Visual collaboration. Bright yellow accent, infinite canvas aesthetic.' },
  { slug: 'intercom',     name: 'Intercom',     category: 'Productivity & SaaS',      desc: 'Customer messaging. Friendly blue palette, conversational UI patterns.' },
  { slug: 'zapier',       name: 'Zapier',       category: 'Productivity & SaaS',      desc: 'Automation platform. Orange accent, workflow-focused, approachable.' },

  // Design & Creative Tools
  { slug: 'figma',        name: 'Figma',        category: 'Design & Creative Tools',  desc: 'Collaborative design tool. Vibrant multi-color, playful yet professional.' },
  { slug: 'framer',       name: 'Framer',       category: 'Design & Creative Tools',  desc: 'Website builder. Bold black and blue, motion-first, design-forward.' },
  { slug: 'webflow',      name: 'Webflow',      category: 'Design & Creative Tools',  desc: 'Visual web builder. Blueprint blue, structured, design-forward.' },
  { slug: 'clay',         name: 'Clay',         category: 'Design & Creative Tools',  desc: 'Creative agency. Organic shapes, soft gradients, art-directed layout.' },

  // Fintech & Crypto
  { slug: 'stripe',       name: 'Stripe',       category: 'Fintech & Crypto',         desc: 'Payment infrastructure. Signature purple gradients, weight-300 elegance.' },
  { slug: 'coinbase',     name: 'Coinbase',     category: 'Fintech & Crypto',         desc: 'Crypto exchange. Clean blue identity, trust-focused, institutional feel.' },
  { slug: 'binance',      name: 'Binance',      category: 'Fintech & Crypto',         desc: 'Crypto exchange. Bold yellow accent on monochrome, trading-floor urgency.' },
  { slug: 'mastercard',   name: 'Mastercard',   category: 'Fintech & Crypto',         desc: 'Global payments network. Warm cream canvas, orbital pill shapes.' },
  { slug: 'revolut',      name: 'Revolut',      category: 'Fintech & Crypto',         desc: 'Neobank. Sleek dark UI, metallic accents, fintech premium.' },
  { slug: 'wise',         name: 'Wise',         category: 'Fintech & Crypto',         desc: 'Global money transfer. Green accent, transparent, trustworthy.' },
  { slug: 'kraken',       name: 'Kraken',       category: 'Fintech & Crypto',         desc: 'Crypto trading. Purple-accented dark UI, data-dense dashboards.' },

  // E-commerce & Retail
  { slug: 'shopify',      name: 'Shopify',      category: 'E-commerce & Retail',      desc: 'E-commerce platform. Dark-first cinematic, neon green accent.' },
  { slug: 'airbnb',       name: 'Airbnb',       category: 'E-commerce & Retail',      desc: 'Travel marketplace. Warm coral accent, photography-driven, rounded UI.' },
  { slug: 'nike',         name: 'Nike',         category: 'E-commerce & Retail',      desc: 'Athletic retail. Monochrome UI, massive uppercase type, full-bleed photography.' },
  { slug: 'starbucks',    name: 'Starbucks',    category: 'E-commerce & Retail',      desc: 'Coffee retail. Four-tier green system, warm cream canvas, full-pill buttons.' },
  { slug: 'hp',           name: 'HP',           category: 'E-commerce & Retail',      desc: 'Consumer electronics. White canvas with electric blue accent, angular chevron motifs.' },

  // Media & Consumer Tech
  { slug: 'apple',        name: 'Apple',        category: 'Media & Consumer Tech',    desc: 'Consumer electronics. Premium white space, SF Pro, cinematic imagery.' },
  { slug: 'spotify',      name: 'Spotify',      category: 'Media & Consumer Tech',    desc: 'Music streaming. Vibrant green on dark, bold type, album-art-driven.' },
  { slug: 'meta',         name: 'Meta',         category: 'Media & Consumer Tech',    desc: 'Tech giant. Photography-first, binary light/dark surfaces, Meta Blue CTAs.' },
  { slug: 'theverge',     name: 'The Verge',    category: 'Media & Consumer Tech',    desc: 'Tech editorial. Acid-mint and ultraviolet accents, rave-flyer story tiles.' },
  { slug: 'playstation',  name: 'PlayStation',  category: 'Media & Consumer Tech',    desc: 'Gaming console retail. Three-surface channel layout, cyan hover-scale.' },
  { slug: 'pinterest',    name: 'Pinterest',    category: 'Media & Consumer Tech',    desc: 'Visual discovery. Red accent, masonry grid, image-first.' },
  { slug: 'uber',         name: 'Uber',         category: 'Media & Consumer Tech',    desc: 'Mobility platform. Bold black and white, tight type, urban energy.' },
  { slug: 'vodafone',     name: 'Vodafone',     category: 'Media & Consumer Tech',    desc: 'Global telecom. Monumental uppercase display, Vodafone Red chapter bands.' },
  { slug: 'wired',        name: 'Wired',        category: 'Media & Consumer Tech',    desc: 'Tech journalism. Bold typographic editorial, black-white-yellow palette.' },
  { slug: 'spacex',       name: 'SpaceX',       category: 'Media & Consumer Tech',    desc: 'Space technology. Stark black and white, full-bleed imagery, futuristic.' },
  { slug: 'superhuman',   name: 'Superhuman',   category: 'Media & Consumer Tech',    desc: 'Fast email client. Premium dark UI, keyboard-first, purple glow.' },
  { slug: 'dell-1996',    name: 'Dell (1996)',  category: 'Media & Consumer Tech',    desc: 'Catalog-era PC retail. Flat color-block ribbon cards, retro web aesthetic.' },

  // Automotive
  { slug: 'tesla',        name: 'Tesla',        category: 'Automotive',               desc: 'Electric automotive. Radical subtraction, full-viewport photography, near-zero UI.' },
  { slug: 'bmw',          name: 'BMW',          category: 'Automotive',               desc: 'Luxury automotive. Dark premium surfaces, precise German engineering aesthetic.' },
  { slug: 'bmw-m',        name: 'BMW M',        category: 'Automotive',               desc: 'Motorsport automotive. Pure black canvas, M tricolor stripe accents.' },
  { slug: 'ferrari',      name: 'Ferrari',      category: 'Automotive',               desc: 'Luxury automotive. Chiaroscuro editorial, Ferrari Red accents, cinematic black.' },
  { slug: 'bugatti',      name: 'Bugatti',      category: 'Automotive',               desc: 'Hypercar brand. Cinema-black canvas, monochrome austerity, monumental display type.' },
  { slug: 'lamborghini',  name: 'Lamborghini',  category: 'Automotive',               desc: 'Supercar brand. True black surfaces, gold accents, dramatic uppercase typography.' },
  { slug: 'renault',      name: 'Renault',      category: 'Automotive',               desc: 'French automotive. Bold diamond logo, modern European design language.' },
];

export const CATEGORY_ORDER = [
  'AI & LLM Platforms',
  'Developer Tools & IDEs',
  'Backend, Database & DevOps',
  'Productivity & SaaS',
  'Design & Creative Tools',
  'Fintech & Crypto',
  'E-commerce & Retail',
  'Media & Consumer Tech',
  'Automotive',
];

export function getCategories(): Array<{ name: string; count: number }> {
  return CATEGORY_ORDER.map((name) => ({
    name,
    count: DESIGNS.filter((d) => d.category === name).length,
  }));
}

export function getByCategory(category: string): DesignEntry[] {
  return DESIGNS.filter((d) => d.category === category);
}
