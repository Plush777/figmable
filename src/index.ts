#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { getConfig, saveConfig } from "./config";
import { fetchFigmaVariables } from "./fetchFigmaVariables";
import { updateCssVariables } from "./figmaToColor";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import ora from "ora";

const argv = yargs(hideBin(process.argv))
  .command("config", "Save configuration", (yargs) => {
    return yargs
      .option("fileKey", {
        description: "Figma File Key",
        type: "string",
      })
      .option("token", {
        description: "Figma API Token",
        type: "string",
      })
      .option("path", {
        description: "CSS file path",
        type: "string",
      })
      .option("output", {
        description: "Path to save Figma variables JSON",
        type: "string",
      });
  })
  .command("show", "Show current configuration", () => {
    const config = getConfig();
    if (!config) {
      console.error("❌ Configuration file not found.");
      console.error("To save configuration, use the following command:");
      console.error(
        "  figmable config --fileKey YOUR_KEY --token YOUR_TOKEN --path YOUR_PATH"
      );
      return;
    }

    const configPath = path.join(os.homedir(), ".figmablerc");
    const figmaFileUrl = `https://www.figma.com/file/${config.FIGMA_FILE_KEY}`;

    console.log(`\n📝 Current Configuration`);
    ~console.log(`  └─ 🔧 Config file: file://${configPath}`);
    console.log(
      "     (You can edit the configuration file directly at the path above!)"
    );
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔑 Figma Settings");
    console.log(`  └─ File Key: ${config.FIGMA_FILE_KEY}`);
    console.log(`     └─ 🔗 ${figmaFileUrl}`);
    console.log(`  └─ API Token: ${config.FIGMA_API_TOKEN}`);
    console.log("\n📁 File Paths");
    console.log(`  └─ 🎨 CSS: ${config.cssFilePath}`);
    console.log(`  └─ 📄 JSON: ${config.outputJsonPath}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  })
  .command("$0", "Sync Figma variables", (yargs) => {
    return yargs
      .option("fileKey", {
        description: "Figma File Key (ignore configuration file)",
        type: "string",
      })
      .option("token", {
        alias: "FIGMA_API_TOKEN",
        description: "Figma API Token",
        type: "string",
      })
      .option("path", {
        alias: "cssFilePath",
        description: "Path to the CSS file",
        type: "string",
      })
      .option("output", {
        alias: "outputJsonPath",
        description: "Path to save figma variables JSON",
        type: "string",
        default: "./figma-variables.json",
      })
      .option("backup", {
        description: "Enable backup file creation",
        type: "boolean",
        default: true,
      })
      .check((argv) => {
        return true;
      });
  })
  .strict(false)
  .help().argv;

/**
 * CLI argument interface
 * @interface Arguments
 */
interface Arguments {
  /** Command arguments */
  _: (string | number)[];
  /** Figma file key */
  fileKey?: string;
  /** Figma API token */
  token?: string;
  /** CSS file path */
  path?: string;
  /** JSON output path */
  output?: string;
  /** Script name */
  $0: string;
  /** File to open */
  open?: string;
  /** Enable backup file creation */
  backup?: boolean;
}

/**
 * Opens a file with the system's default application
 * @param {string} filePath - Path to the file to open
 */
const openPath = (filePath: string) => {
  const command = process.platform === "win32" ? "start" : "open";
  exec(`${command} "${filePath}"`, (error) => {
    if (error) {
      console.error(`❌ File opening failed: ${error.message}`);
    }
  });
};

/**
 * Main function that handles CLI commands and operations
 */
const main = async () => {
  const parsedArgv = argv as Arguments;

  if (parsedArgv._[0] === "config") {
    if (!parsedArgv.fileKey || !parsedArgv.token || !parsedArgv.path) {
      console.error(
        "❌ fileKey, token, and path are required for configuration."
      );
      return;
    }
    const config = {
      FIGMA_FILE_KEY: parsedArgv.fileKey,
      FIGMA_API_TOKEN: parsedArgv.token,
      cssFilePath: parsedArgv.path,
      outputJsonPath: parsedArgv.output || "./figma-variables.json",
    };
    saveConfig(config);
    return;
  }

  if (parsedArgv._[0] === "show") {
    return;
  }

  const config = getConfig();
  if (!config) {
    console.error(
      "❌ Configuration file not found. Use `figmable config` command to save configuration first."
    );
    return;
  }

  const runConfig = {
    FIGMA_FILE_KEY: parsedArgv.fileKey || config.FIGMA_FILE_KEY,
    FIGMA_API_TOKEN: parsedArgv.token || config.FIGMA_API_TOKEN,
    cssFilePath: parsedArgv.path || config.cssFilePath,
    outputJsonPath:
      parsedArgv.output || config.outputJsonPath || "./figma-variables.json",
  };

  const spinner = ora();

  try {
    spinner.start("Fetching Figma variables...");
    const jsonPath = await fetchFigmaVariables(runConfig);
    spinner.succeed(
      `Successfully fetched Figma variables!\n  └─ 📄 JSON file: ${jsonPath}`
    );

    spinner.start("Updating CSS file...");

    const { cssPath, backupPath } = await updateCssVariables({
      cssFilePath: runConfig.cssFilePath,
      jsonFilePath: jsonPath,
      noBackup: !parsedArgv.backup,
    });

    const successMessage = `CSS file successfully updated!\n  └─ 🎨 CSS file: ${cssPath}`;
    if (backupPath) {
      spinner.succeed(`${successMessage}\n  └─ 💾 Backup file: ${backupPath}`);
    } else {
      spinner.succeed(successMessage);
      console.log(
        "\n📝 To enable backup files, run: figmable --backup or just figmable"
      );
    }
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : "An error occurred!");
    process.exit(1);
  }

  if (parsedArgv._[0] === "show") {
    const configPath = path.join(os.homedir(), ".figmablerc");
    const figmaFileUrl = `https://www.figma.com/file/${config.FIGMA_FILE_KEY}`;

    if (parsedArgv.open) {
      switch (parsedArgv.open) {
        case "config":
          openPath(configPath);
          break;
        case "css":
          openPath(path.resolve(config.cssFilePath));
          break;
        case "json":
          openPath(path.resolve(config.outputJsonPath));
          break;
      }
      return;
    }

    console.log("\nCurrent Configuration:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("• Figma File Key:", config.FIGMA_FILE_KEY);
    console.log(`  └─ ${figmaFileUrl}`);
    console.log(
      "• API Token:",
      config.FIGMA_API_TOKEN.slice(0, 4) +
        "..." +
        config.FIGMA_API_TOKEN.slice(-4)
    );
    console.log("• CSS File Path:", config.cssFilePath);
    console.log(`  └─ file://${path.resolve(config.cssFilePath)}`);
    console.log("• JSON File Path:", config.outputJsonPath);
    console.log(`  └─ file://${path.resolve(config.outputJsonPath)}`);
    console.log("• Configuration File Location:");
    console.log(`  └─ file://${configPath}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }
};

main().catch(console.error);
