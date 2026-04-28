/**
 * Module for fetching color variables from Figma
 * @module fetchFigmaVariables
 */

import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { normalizeColorVariableName } from "./normalizeColorVariableName";

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
  /** Node name */
  name?: string;
  /** Child nodes */
  children?: FigmaNode[];
  /** Fill styles including colors */
  fills?: FigmaPaint[];
  /** Applied style references */
  styles?: {
    fill?: string;
  };
}

interface FigmaPaint {
  /** Paint type */
  type?: string;
  /** Whether the paint is visible */
  visible?: boolean;
  /** Solid paint color */
  color?: { r: number; g: number; b: number };
}

interface FigmaStyle {
  /** Style name from Figma */
  name?: string;
  /** Style category */
  styleType?: string;
}

/**
 * Figma API response structure
 * @interface FigmaResponse
 */
interface FigmaResponse {
  /** Root document node */
  document?: FigmaNode;
  /** Local styles keyed by style id */
  styles?: Record<string, FigmaStyle>;
}

/**
 * Fetches color variables from Figma and saves them to a JSON file
 * @param {FigmaFetchArgs} argv - Arguments for the fetch operation
 * @returns {Promise<string>} Path to the saved JSON file
 */
export const fetchFigmaVariables = async (
  argv: FigmaFetchArgs,
): Promise<string> => {
  const { FIGMA_FILE_KEY, FIGMA_API_TOKEN, outputJsonPath } = argv;

  try {
    const response = await axios.get<FigmaResponse>(
      `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}`,
      {
        headers: {
          "X-FIGMA-TOKEN": FIGMA_API_TOKEN,
        },
      },
    );

    const figmaData = response.data;
    if (!figmaData.document) {
      throw new Error("Figma document data could not be found.");
    }

    const extractColors = (
      node: FigmaNode,
      accumulatedColors: Record<string, string>,
    ): Record<string, string> => {
      const colors = { ...accumulatedColors };
      const fill = getSolidFill(node.fills);
      const colorName = getColorName(node, figmaData.styles);

      if (fill?.color && colorName) {
        const { r, g, b } = fill.color;
        const hexColor = rgbToHex(r, g, b);
        const variableName = normalizeColorVariableName(colorName);

        if (!colors[variableName]) {
          colors[variableName] = hexColor;
        }
      }

      if (!node.children) return colors;

      return node.children.reduce((acc, child) => {
        return extractColors(child, acc);
      }, colors);
    };

    const colors = extractColors(figmaData.document, {});
    if (Object.keys(colors).length === 0) {
      throw new Error(
        "No color styles or color nodes could be found in the Figma file.",
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
        `❌ The directory ${outputDir} does not exist. Creating the directory.`,
      );
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(colors, null, 2));

    return outputPath;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 403) {
        throw new Error(
          "The Figma API token is invalid or you do not have access to the file.",
        );
      }
    }
    throw error;
  }
};

const getSolidFill = (fills?: FigmaPaint[]): FigmaPaint | undefined => {
  return fills?.find((fill) => {
    return fill.visible !== false && fill.type === "SOLID" && fill.color;
  });
};

const getColorName = (
  node: FigmaNode,
  styles?: Record<string, FigmaStyle>,
): string | undefined => {
  const fillStyleId = node.styles?.fill;
  const fillStyle = fillStyleId ? styles?.[fillStyleId] : undefined;

  if (fillStyle?.styleType === "FILL" && fillStyle.name) {
    return fillStyle.name;
  }

  return node.name?.startsWith("--") ? node.name : undefined;
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
