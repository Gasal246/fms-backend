export function getDefaultAvatarUrl(name: string): string {
  const sanitized = encodeURIComponent(name.trim());
  // Generates a clean, modern, colored avatar matching the FMD brand (indigo text, purple-tinted bg)
  return `https://ui-avatars.com/api/?name=${sanitized}&background=e0e7ff&color=4f46e5&bold=true&size=150`;
}
