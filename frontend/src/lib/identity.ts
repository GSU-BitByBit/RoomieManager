type IdentityLabelInput = {
  displayName?: string | null;
  fullName?: string | null;
  email?: string | null;
  userId?: string | null;
  fallbackLabel?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_NAME_NOISE_TOKENS = new Set([
  'roomiemanager',
  'roomiesyncai',
]);

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function isEmailLike(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  return EMAIL_PATTERN.test(value.trim());
}

function normalizeHumanName(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = collapseWhitespace(value);
  if (!normalized || isEmailLike(normalized)) {
    return null;
  }

  return normalized;
}

function titleCaseWord(word: string): string {
  if (!word) {
    return word;
  }

  if (word.length === 1) {
    return word.toUpperCase();
  }

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function prettifyEmailLocalPart(email: string | null | undefined): string | null {
  if (!isEmailLike(email)) {
    return null;
  }

  const [rawLocalPart] = email.trim().split('@');
  const localPart = rawLocalPart.replace(/\+.*$/, '');
  const tokens = collapseWhitespace(
    localPart.replace(/[._-]+/g, ' ').replace(/\d+/g, (match) => ` ${match} `),
  )
    .split(' ')
    .filter(Boolean);

  const filteredTokens = tokens.filter((token) => {
    const lowerToken = token.toLowerCase();
    return !EMAIL_NAME_NOISE_TOKENS.has(lowerToken) && !/^\d+$/.test(lowerToken);
  });

  const cleanedTokens = filteredTokens.length > 0 ? filteredTokens : tokens.filter((token) => !/^\d+$/.test(token));
  const cleaned = collapseWhitespace(cleanedTokens.join(' '));

  if (!cleaned) {
    return null;
  }

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map(titleCaseWord)
    .join(' ');
}

function abbreviateUserId(userId: string | null | undefined): string | null {
  if (!userId) {
    return null;
  }

  const normalized = userId.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length <= 12) {
    return normalized;
  }

  return `${normalized.slice(0, 8)}...`;
}

export function resolveIdentityLabel({
  displayName,
  fullName,
  email,
  userId,
  fallbackLabel = 'Unknown user',
}: IdentityLabelInput): string {
  const primaryDisplayName = normalizeHumanName(displayName);
  if (primaryDisplayName) {
    return primaryDisplayName;
  }

  const alternateFullName = normalizeHumanName(fullName);
  if (alternateFullName) {
    return alternateFullName;
  }

  const prettifiedDisplayName = prettifyEmailLocalPart(displayName);
  if (prettifiedDisplayName) {
    return prettifiedDisplayName;
  }

  const prettifiedEmail = prettifyEmailLocalPart(email);
  if (prettifiedEmail) {
    return prettifiedEmail;
  }

  if (isEmailLike(displayName)) {
    return displayName.trim();
  }

  if (isEmailLike(email)) {
    return email.trim();
  }

  return abbreviateUserId(userId) ?? fallbackLabel;
}

export function getDisplayInitial(label: string): string {
  const match = label.match(/[A-Za-z0-9]/u);
  return match ? match[0].toUpperCase() : '?';
}
