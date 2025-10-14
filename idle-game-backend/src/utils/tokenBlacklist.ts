// 简易内存黑名单实现。生产环境建议使用Redis并设置过期时间。

const blacklist = new Map<string, number>(); // token -> expiresAt(ms)

export function blacklistToken(token: string, ttlSeconds: number) {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  blacklist.set(token, expiresAt);
}

export function isTokenBlacklisted(token: string): boolean {
  const expiresAt = blacklist.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    blacklist.delete(token);
    return false;
  }
  return true;
}

export function cleanupBlacklist() {
  const now = Date.now();
  for (const [token, expiresAt] of blacklist.entries()) {
    if (now > expiresAt) {
      blacklist.delete(token);
    }
  }
}

export default {
  blacklistToken,
  isTokenBlacklisted,
  cleanupBlacklist,
};


