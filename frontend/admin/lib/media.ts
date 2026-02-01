export function resolveMediaUrl(path?: string | null): string | null {
  if (!path) return null;

  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("/static/")
  ) {
    return path;
  }

  return `/static/uploads/${path}`;
}
