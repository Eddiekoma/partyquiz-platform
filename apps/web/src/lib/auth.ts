/**
 * Re-export everything from the main auth configuration
 * This ensures all imports (from @/auth or @/lib/auth) use the same instance
 */
export { handlers, auth, signIn, signOut } from "@/auth";

// Import handlers and re-export for API route
import { handlers } from "@/auth";
export const { GET, POST } = handlers;