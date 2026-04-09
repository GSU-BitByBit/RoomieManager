type AuthIdentityInput = {
  email?: string | null;
  userMetadata?: Record<string, unknown>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_NAME_NOISE_TOKENS = new Set([
  'roomiemanager',
  'roomiesyncai',
]);

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isEmailLike(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  return EMAIL_PATTERN.test(value.trim());
}

function normalizeHumanName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = collapseWhitespace(value);
  if (!normalized || isEmailLike(normalized)) {
    return null;
  }

  return normalized;
}

function prettifyEmailLocalPart(email: string | null | undefined): string | null {
  if (!isEmailLike(email)) {
    return null;
  }

  const [rawLocalPart] = email.trim().split('@');
  const tokens = collapseWhitespace(
    rawLocalPart.replace(/\+.*$/, '').replace(/[._-]+/g, ' ').replace(/\d+/g, (match) => ` ${match} `),
  )
    .split(' ')
    .filter(Boolean);

  const filteredTokens = tokens.filter((token) => {
    const lowerToken = token.toLowerCase();
    return !EMAIL_NAME_NOISE_TOKENS.has(lowerToken) && !/^\d+$/.test(lowerToken);
  });

  const cleanedTokens =
    filteredTokens.length > 0
      ? filteredTokens
      : tokens.filter((token) => !/^\d+$/.test(token));
  const cleaned = collapseWhitespace(cleanedTokens.join(' '));

  if (!cleaned) {
    return null;
  }

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function getMetadataName(userMetadata?: Record<string, unknown>): string | null {
  if (!userMetadata) {
    return null;
  }

  return (
    normalizeHumanName(userMetadata.full_name) ??
    normalizeHumanName(userMetadata.display_name) ??
    normalizeHumanName(userMetadata.name)
  );
}

export function resolveAuthIdentityDisplayName({
  email,
  userMetadata,
}: AuthIdentityInput): string | null {
  const metadataName = getMetadataName(userMetadata);
  if (metadataName) {
    return metadataName;
  }

  const prettifiedEmail = prettifyEmailLocalPart(email);
  if (prettifiedEmail) {
    return prettifiedEmail;
  }

  if (isEmailLike(email)) {
    return email.trim();
  }

  return null;
}
