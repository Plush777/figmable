/**
 * Module for updating CSS files with Figma color variables
 * @module figmaToColor
 */

import * as fs from "fs";
import { normalizeColorVariableName } from "./normalizeColorVariableName";

/**
 * Arguments for CSS update operation
 * @interface Argv
 */
interface Argv {
  /** Path to the CSS file to update */
  cssFilePath: string;
  /** Path to the JSON file containing Figma variables */
  jsonFilePath: string;
  /** Disable backup file creation */
  noBackup?: boolean;
}

/**
 * Updates CSS file with color variables from Figma
 * @param {Argv} argv - Arguments for the update operation
 * @returns {Promise<{ cssPath: string; backupPath: string }>} Paths to the updated CSS and backup files
 */
export const updateCssVariables = async (
  argv: Argv,
): Promise<{ cssPath: string; backupPath: string }> => {
  const { cssFilePath, jsonFilePath, noBackup = false } = argv;

  let figmaVariables: Record<string, string>;
  try {
    if (!fs.existsSync(jsonFilePath)) {
      throw new Error(
        `JSON file not found: ${jsonFilePath}\nPlease fetch Figma variables first.`,
      );
    }
    figmaVariables = JSON.parse(fs.readFileSync(jsonFilePath, "utf-8"));
  } catch (err) {
    throw new Error(`Error reading JSON file (${jsonFilePath}): ${err}`);
  }

  let globalCss: string;
  try {
    globalCss = fs.readFileSync(cssFilePath, "utf-8");
  } catch (err) {
    throw new Error(`Error reading CSS file at ${cssFilePath}: ${err}`);
  }

  const normalizedFigmaVariables = normalizeFigmaVariables(figmaVariables);
  globalCss = normalizeExistingCssVariables(globalCss, normalizedFigmaVariables);

  const existingVariables: Set<string> = new Set();

  const rootContentMatch: RegExpMatchArray | null =
    globalCss.match(/:root \{([^}]*)\}/);

  if (rootContentMatch) {
    const rootContent: string = rootContentMatch[1];
    const regex: RegExp = /--[^:\s]+\s*:\s*[^;]+;/g;
    const existingVars: RegExpMatchArray | null = rootContent.match(regex);

    if (existingVars) {
      existingVars.forEach((varDeclaration: string) => {
        const varName: string = varDeclaration.split(":")[0].trim();
        existingVariables.add(varName);
      });
    }
  }

  const generateCssVariables = (
    colors: Record<string, string>,
    existingVariables: Set<string>,
  ): string => {
    let cssVariables: string = "";

    for (const [key, value] of Object.entries(colors)) {
      if (key.startsWith("--")) {
        const variableName = normalizeColorVariableName(key);
        if (!existingVariables.has(variableName)) {
          cssVariables += `    ${variableName}: ${value};\n`;
        }
      }
    }

    return cssVariables;
  };

  const updatedCss: string = globalCss.replace(
    /:root \{([^}]*)\}/,
    (match: string, rootContent: string) => {
      const newVariables: string = generateCssVariables(
        normalizedFigmaVariables,
        existingVariables,
      );
      return match.replace(rootContent, `${rootContent}\n${newVariables}`);
    },
  );

  const backupFilePath = `${cssFilePath}.bak`;
  let backupCreated = "";

  if (!noBackup) {
    fs.copyFileSync(cssFilePath, backupFilePath);
    backupCreated = backupFilePath;
  }

  fs.writeFileSync(cssFilePath, updatedCss);

  return {
    cssPath: cssFilePath,
    backupPath: backupCreated,
  };
};

const normalizeFigmaVariables = (
  variables: Record<string, string>,
): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [
      normalizeColorVariableName(key),
      value,
    ]),
  );
};

const normalizeExistingCssVariables = (
  css: string,
  colors: Record<string, string>,
): string => {
  const variableNameMap = new Map<string, string>();

  Object.keys(colors).forEach((variableName) => {
    variableNameMap.set(variableName, variableName);
    if (variableName.startsWith("--color-")) {
      variableNameMap.set(
        `--${variableName.slice("--color-".length)}`,
        variableName,
      );
    }
  });

  return css.replace(/:root \{([^}]*)\}/, (match, rootContent: string) => {
    const normalizedVariables = new Set<string>();
    const normalizedRootContent = rootContent.replace(
      /(--[^:\s]+)(\s*:\s*[^;]+;)/g,
      (declaration, variableName: string, declarationValue: string) => {
        const normalizedName =
          variableNameMap.get(variableName) ||
          variableNameMap.get(normalizeColorVariableName(variableName));

        if (!normalizedName) {
          return declaration;
        }

        if (normalizedVariables.has(normalizedName)) {
          return "";
        }

        normalizedVariables.add(normalizedName);
        return `${normalizedName}${declarationValue}`;
      },
    );

    return match.replace(rootContent, normalizedRootContent);
  });
};
