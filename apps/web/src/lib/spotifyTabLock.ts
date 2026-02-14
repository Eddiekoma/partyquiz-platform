/**
 * Spotify Tab Lock
 *
 * Prevents multiple tabs on the same device from both running the
 * Spotify Web Playback SDK.  Uses BroadcastChannel (supported in all
 * modern browsers) for cross-tab coordination.
 *
 * How it works:
 * 1. Tab calls `acquireLock(sessionCode)`.
 * 2. We broadcast a "CLAIM" message. Other tabs holding the lock for
 *    the same session respond with "RELEASE" and tear down their SDK.
 * 3. If no rejection arrives within 200ms, the lock is acquired.
 * 4. On `releaseLock()`, we broadcast "RELEASE" so other tabs know
 *    they can claim.
 *
 * The lock is advisory – it doesn't prevent playback, it just tells
 * the calling code whether it should load the SDK.
 */

const CHANNEL_NAME = "partyquiz-spotify-lock";
const CLAIM_TIMEOUT_MS = 200;

type LockMessage =
  | { type: "CLAIM"; sessionCode: string; tabId: string }
  | { type: "RELEASE"; sessionCode: string; tabId: string }
  | { type: "REJECT"; sessionCode: string; tabId: string };

let channel: BroadcastChannel | null = null;
let currentTabId: string | null = null;
let currentSessionCode: string | null = null;
let onRevoked: (() => void) | null = null;

function getChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = handleMessage;
  }
  return channel;
}

function generateTabId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function handleMessage(event: MessageEvent<LockMessage>) {
  const msg = event.data;
  if (!currentTabId || !currentSessionCode) return;
  if (msg.sessionCode !== currentSessionCode) return;
  if (msg.tabId === currentTabId) return; // Ignore own messages

  switch (msg.type) {
    case "CLAIM":
      // Another tab wants the lock for the same session.
      // We release ours and notify them.
      if (onRevoked) {
        onRevoked();
        onRevoked = null;
      }
      getChannel().postMessage({
        type: "RELEASE",
        sessionCode: currentSessionCode,
        tabId: currentTabId,
      } satisfies LockMessage);
      currentSessionCode = null;
      break;

    case "RELEASE":
      // Another tab released – we don't need to do anything here,
      // the claim flow handles waiting.
      break;
  }
}

/**
 * Try to acquire the Spotify SDK lock for a session.
 *
 * @param sessionCode The quiz session code
 * @param onLockRevoked Called if another tab claims the lock later
 * @returns true if lock was acquired
 */
export async function acquireSpotifyLock(
  sessionCode: string,
  onLockRevoked: () => void
): Promise<boolean> {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    // SSR or very old browser → just allow
    return true;
  }

  currentTabId = generateTabId();
  currentSessionCode = sessionCode;
  onRevoked = onLockRevoked;

  const ch = getChannel();

  return new Promise<boolean>((resolve) => {
    let rejected = false;

    // Listen for REJECT from a tab that won't give up
    const rejectHandler = (e: MessageEvent<LockMessage>) => {
      if (
        e.data.type === "REJECT" &&
        e.data.sessionCode === sessionCode &&
        e.data.tabId !== currentTabId
      ) {
        rejected = true;
      }
    };
    ch.addEventListener("message", rejectHandler as any);

    // Broadcast claim
    ch.postMessage({
      type: "CLAIM",
      sessionCode,
      tabId: currentTabId!,
    } satisfies LockMessage);

    // Wait for potential rejection
    setTimeout(() => {
      ch.removeEventListener("message", rejectHandler as any);
      if (rejected) {
        currentSessionCode = null;
        resolve(false);
      } else {
        resolve(true);
      }
    }, CLAIM_TIMEOUT_MS);
  });
}

/**
 * Release the lock so another tab can claim it.
 */
export function releaseSpotifyLock(): void {
  if (!currentTabId || !currentSessionCode) return;

  if (channel) {
    channel.postMessage({
      type: "RELEASE",
      sessionCode: currentSessionCode,
      tabId: currentTabId,
    } satisfies LockMessage);
  }

  onRevoked = null;
  currentSessionCode = null;
}

/**
 * Check if this tab currently holds the lock for a session.
 */
export function hasSpotifyLock(sessionCode: string): boolean {
  return currentSessionCode === sessionCode && currentTabId !== null;
}

/**
 * Cleanup – call on unmount / page unload.
 */
export function destroySpotifyLock(): void {
  releaseSpotifyLock();
  if (channel) {
    channel.close();
    channel = null;
  }
  currentTabId = null;
}
