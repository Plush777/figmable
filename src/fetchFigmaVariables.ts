/**
 * Module for fetching color variables from Figma
 * @module fetchFigmaVariables
 */

import * as fs from "fs";
import * as path from "path";
import axios from "axios";

/**
 * Arguments for Figma API fetch operation
 * @interface FigmaFetchArgs
 */
interface FigmaFetchArgs {
  /** Figma file key from the file URL */
  FIGMA_FILE_KEY: string;
  /** Figma API access token */
  FIGMA_API_TOKEN: string;
  /** Path to save the JSON output */
  outputJsonPath: string;
}

/**
 * Figma node structure from API response
 * @interface FigmaNode
 */
interface FigmaNode {
  /** Node ID */
  id?: string;
  /** Node type */
  type?: string;
  /** Node name */
  name?: string;
  /** Text contents (for TEXT nodes) */
  characters?: string;
  /** Child nodes */
  children?: FigmaNode[];
  /** Fill styles including colors */
  fills?: { type?: string; color?: { r: number; g: number; b: number }; opacity?: number }[];
}

/**
 * Figma API response structure
 * @interface FigmaResponse
 */
interface FigmaResponse {
  /** Root document node */
  document?: FigmaNode;
}

/**
 * Fetches color variables from Figma and saves them to a JSON file
 * @param {FigmaFetchArgs} argv - Arguments for the fetch operation
 * @returns {Promise<string>} Path to the saved JSON file
 */
export const fetchFigmaVariables = async (
  argv: FigmaFetchArgs
): Promise<string> => {
  const { FIGMA_FILE_KEY, FIGMA_API_TOKEN, outputJsonPath } = argv;

  try {
    const response = await axios.get<FigmaResponse>(
      `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}`,
      {
        headers: {
          "X-FIGMA-TOKEN": FIGMA_API_TOKEN,
        },
      }
    );

    const figmaData = response.data;
    if (!figmaData.document) {
      throw new Error("Figma document data could not be found.");
    }

    const toKebabCase = (value: string): string =>
      value
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/_/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    const readLabel = (node?: FigmaNode): string | undefined => {
      if (!node) return undefined;
      if (node.type === "TEXT" && node.characters?.trim()) {
        return node.characters.trim();
      }
      return node.name?.trim();
    };

    const readTextCharacters = (node?: FigmaNode): string | undefined => {
      if (!node || node.type !== "TEXT") return undefined;
      return node.characters?.trim();
    };

    const findNumericName = (node: FigmaNode): string | undefined => {
      const currentLabel = readTextCharacters(node);
      if (currentLabel && /^\d+$/.test(currentLabel)) {
        return currentLabel;
      }

      const numericChild = node.children?.find(
        (child) => !!readTextCharacters(child) && /^\d+$/.test(readTextCharacters(child) as string)
      );

      return readTextCharacters(numericChild);
    };

    const findPaletteLabel = (node: FigmaNode): string | undefined => {
      const labelCandidate = node.children?.find((child) => {
        const label = readTextCharacters(child);
        return (
          !!label &&
          !label.startsWith("--") &&
          !/^\d+$/.test(label) &&
          !["color", "img_gray_color", "colors"].includes(label.toLowerCase())
        );
      });

      return readTextCharacters(labelCandidate);
    };

    const findCategoryLabel = (node: FigmaNode): string | undefined => {
      const nodeLabel = readLabel(node)?.toLowerCase();
      if (nodeLabel && ["color", "colors"].includes(nodeLabel)) {
        return nodeLabel;
      }

      const categoryChild = node.children?.find((child) => {
        const label = readLabel(child)?.toLowerCase();
        return !!label && ["color", "colors"].includes(label);
      });

      return readLabel(categoryChild)?.toLowerCase();
    };

    const getSolidFillColor = (node: FigmaNode): string | undefined => {
      const solidFill = node.fills?.find(
        (fill) => fill.type === "SOLID" && !!fill.color
      );
      if (!solidFill?.color) return undefined;

      const { r, g, b } = solidFill.color;
      return rgbToHex(r, g, b);
    };

    const collectNodes = (node: FigmaNode): FigmaNode[] => {
      const descendants = node.children?.flatMap((child) => collectNodes(child)) || [];
      return [node, ...descendants];
    };

    const extractColors = (
      node: FigmaNode,
      accumulatedColors: Record<string, string>,
      context: { paletteName?: string; categoryName?: string } = {},
      parent?: FigmaNode
    ): Record<string, string> => {
      const paletteName = findPaletteLabel(node) || context.paletteName;
      const categoryName = findCategoryLabel(node) || context.categoryName;

      if (!node.children) return accumulatedColors;

      node.children.forEach((child) => {
        const hexColor = getSolidFillColor(child);

        if (hexColor) {
          const explicitName = readLabel(child);
          if (explicitName?.startsWith("--")) {
            const colorName = explicitName.toLowerCase();
            if (!accumulatedColors[colorName]) {
              accumulatedColors[colorName] = hexColor;
            }
          } else if (paletteName) {
            const shade =
              findNumericName(child) ||
              findNumericName(node) ||
              (parent ? findNumericName(parent) : undefined);

            const normalizedCategory = categoryName
              ? toKebabCase(categoryName)
              : "";
            const normalizedPalette = toKebabCase(paletteName);
            const paletteKey = normalizedCategory
              ? `${normalizedCategory}-${normalizedPalette}`
              : normalizedPalette;
            const generatedName = shade
              ? `--${paletteKey}-${shade}`
              : `--${paletteKey}`;

            if (paletteKey && !accumulatedColors[generatedName]) {
              accumulatedColors[generatedName] = hexColor;
            }
          }
        }

        extractColors(child, accumulatedColors, { paletteName, categoryName }, node);
      });

      return accumulatedColors;
    };

    const allNodes = collectNodes(figmaData.document);
    const colors = extractColors(figmaData.document, {});

    if (Object.keys(colors).length === 0) {
      const nodePreview = allNodes
        .slice(0, 15)
        .map((node) => `${node.id || "unknown"}:${node.type || "UNKNOWN"}:${node.name || "(unnamed)"}`)
        .join(" | ");

      console.warn(
        `⚠️ No color variables were extracted. Parsed ${allNodes.length} nodes from /v1/files response.\n` +
          `Node preview: ${nodePreview}`
      );
    }

    let outputDir;
    let outputPath;

    try {
      if (fs.existsSync(outputJsonPath)) {
        const stats = fs.statSync(outputJsonPath);
        outputDir = stats.isDirectory()
          ? outputJsonPath
          : path.dirname(outputJsonPath);
        outputPath = stats.isDirectory()
          ? `${outputJsonPath}/figma-variables.json`
          : outputJsonPath;
      } else {
        if (outputJsonPath.endsWith(".json")) {
          outputDir = path.dirname(outputJsonPath);
          outputPath = outputJsonPath;
        } else {
          outputDir = outputJsonPath;
          outputPath = `${outputJsonPath}/figma-variables.json`;
        }
      }
    } catch (error) {
      outputDir = "./";
      outputPath = "./figma-variables.json";
    }

    if (!fs.existsSync(outputDir)) {
      console.log(
        `❌ The directory ${outputDir} does not exist. Creating the directory.`
      );
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(colors, null, 2));

    return outputPath;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 403) {
        throw new Error(
          "The Figma API token is invalid or you do not have access to the file."
        );
      }
    }
    throw error;
  }
};

/**
 * Converts RGB values to hexadecimal color string
 * @param {number} r - Red value (0-1)
 * @param {number} g - Green value (0-1)
 * @param {number} b - Blue value (0-1)
 * @returns {string} Hexadecimal color string
 */
const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (x: number): string => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
