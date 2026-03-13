type TypingEntry = {
  userId: string;
  fullName: string;
  expiresAt: number;
};

const TYPING_TTL_MS = 5000;

declare global {
  // eslint-disable-next-line no-var
  var threadTypingState: Map<string, Map<string, TypingEntry>> | undefined;
}

function getStore() {
  if (!globalThis.threadTypingState) {
    globalThis.threadTypingState = new Map();
  }

  return globalThis.threadTypingState;
}

function cleanupThread(threadId: string) {
  const store = getStore();
  const entries = store.get(threadId);

  if (!entries) {
    return new Map<string, TypingEntry>();
  }

  const now = Date.now();
  for (const [userId, entry] of entries) {
    if (entry.expiresAt <= now) {
      entries.delete(userId);
    }
  }

  if (entries.size === 0) {
    store.delete(threadId);
    return new Map<string, TypingEntry>();
  }

  return entries;
}

export function markThreadTyping(threadId: string, userId: string, fullName: string) {
  const store = getStore();
  const entries = cleanupThread(threadId);

  entries.set(userId, {
    userId,
    fullName,
    expiresAt: Date.now() + TYPING_TTL_MS,
  });

  store.set(threadId, entries);
}

export function listThreadTyping(threadId: string) {
  return [...cleanupThread(threadId).values()].map((entry) => ({
    userId: entry.userId,
    fullName: entry.fullName,
  }));
}
