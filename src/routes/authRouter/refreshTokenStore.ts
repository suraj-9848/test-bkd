// Simple in-memory store for refresh tokens (replace with Redis/DB for production)
const refreshTokens = new Map<string, string>();

export function saveRefreshToken(userId: string, token: string) {
  refreshTokens.set(userId, token);
}

export function getRefreshToken(userId: string) {
  return refreshTokens.get(userId);
}

export function deleteRefreshToken(userId: string) {
  refreshTokens.delete(userId);
}
