/**
 * Asset URL Utilities
 * 
 * Resolves public asset URLs correctly for both dev server
 * and production deployments under sub-paths (e.g., /space-readers/).
 * 
 * In Vite, `import.meta.env.BASE_URL` is automatically set from the
 * `base` config option and is available at runtime.
 */

/**
 * Get the base URL for the app (e.g., "/" or "/space-readers/")
 */
export function getBaseUrl(): string {
  return import.meta.env.BASE_URL || '/';
}

/**
 * Resolve a public asset path to a full URL including the base path.
 * 
 * @param path - The asset path relative to public/ (e.g., "/intro.mp4" or "intro.mp4")
 * @returns The full URL including the base path
 * 
 * @example
 * // With base = "/space-readers/"
 * resolveAssetUrl("/intro.mp4") // => "/space-readers/intro.mp4"
 * resolveAssetUrl("intro.mp4")  // => "/space-readers/intro.mp4"
 */
export function resolveAssetUrl(path: string): string {
  const base = getBaseUrl();
  
  // Remove leading slash from path if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Ensure base ends with slash
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  
  return `${cleanBase}${cleanPath}`;
}

/**
 * Resolve multiple asset URLs at once
 */
export function resolveAssetUrls<T extends Record<string, string>>(paths: T): T {
  const result: Record<string, string> = {};
  for (const [key, path] of Object.entries(paths)) {
    result[key] = resolveAssetUrl(path);
  }
  return result as T;
}
