const MEMBER_COLOR_PALETTES = [
  {
    accent: 'bg-sage-500',
    softBg: 'bg-sage-50/80',
    softBorder: 'border-sage-200/80',
    softText: 'text-sage-700',
    mutedText: 'text-sage-600',
  },
  {
    accent: 'bg-dusty-500',
    softBg: 'bg-dusty-50/80',
    softBorder: 'border-dusty-200/80',
    softText: 'text-dusty-700',
    mutedText: 'text-dusty-600',
  },
  {
    accent: 'bg-blush-500',
    softBg: 'bg-blush-50/80',
    softBorder: 'border-blush-200/80',
    softText: 'text-blush-700',
    mutedText: 'text-blush-600',
  },
  {
    accent: 'bg-lavender-500',
    softBg: 'bg-lavender-50/80',
    softBorder: 'border-lavender-200/80',
    softText: 'text-lavender-700',
    mutedText: 'text-lavender-600',
  },
  {
    accent: 'bg-brand-500',
    softBg: 'bg-brand-50/80',
    softBorder: 'border-brand-200/80',
    softText: 'text-brand-700',
    mutedText: 'text-brand-600',
  },
] as const;

function hashValue(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getMemberColorClasses(userId: string) {
  return MEMBER_COLOR_PALETTES[hashValue(userId) % MEMBER_COLOR_PALETTES.length];
}
