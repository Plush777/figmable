/**
 * Normalizes color variable names to use the `--color-` prefix.
 * @param variableName Original Figma or CSS variable name
 * @returns Normalized CSS custom property name
 */
export const normalizeColorVariableName = (variableName: string): string => {
  const normalizedName = variableName
    .trim()
    .toLowerCase()
    .replace(/&amp;/g, "-")
    .replace(/^--+/, "")
    .replace(/[\/_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!normalizedName) {
    return variableName.trim().toLowerCase();
  }

  if (normalizedName.startsWith("color-")) {
    return `--${normalizedName}`;
  }

  return `--color-${normalizedName}`;
};
