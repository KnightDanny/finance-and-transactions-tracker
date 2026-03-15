/**
 * Generate a simple unique ID without native crypto dependencies.
 * Uses timestamp + random hex to create a UUID-like string.
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  const randomPart2 = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}-${randomPart2}`;
}
