# Figmable

![Image](https://github.com/user-attachments/assets/094e589d-c835-484d-95bd-f32fc55a88f0)
English | [한국어](.docs/README.ko.md)

![npm](https://img.shields.io/npm/v/figmable) ![npm](https://img.shields.io/npm/dt/figmable) ![npm bundle size](https://img.shields.io/bundlephobia/min/figmable) ![license](https://img.shields.io/npm/l/figmable)

🔗 [figmable on npm](https://www.npmjs.com/package/figmable)

Figmable is a CLI tool that helps you sync color variables from your Figma design files directly to your CSS files. It extracts color variables from Figma and automatically updates your CSS files with the new color variables, making the design-to-development workflow seamless.

## Quick Start

```bash
# 1. Save your configuration (one-time setup)
figmable config --fileKey YOUR_KEY --token YOUR_TOKEN --path ./src/styles/global.css

# 2. Run Figmable - That's it! 🎉
figmable

# Your CSS is now updated with Figma color variables!
```

Just two commands and you're done! Figmable will:

- Fetch your color variables from Figma
- Save them as JSON for reference
- Automatically update your CSS file
- Create a backup, just in case

> 🎨 **Why Figmable?**  
> While Figma provides a `/variables` API endpoint to fetch local variables, it's only available for paid plans.
> Figmable offers a free alternative by extracting color codes from your Figma color palette and converting them into CSS variables!

## Features

- 🎨 Extract color variables from Figma files
- 🔄 Automatically sync with your CSS files
- 🔒 Preserve existing CSS variables
- 💾 Automatic backup of CSS files before updating
- 📦 Easy to integrate into your workflow
- ⚡️ Simple configuration management

## Prerequisites

1. **Figma API Token**

   - Go to Figma > Account Settings > Access tokens
   - Create a new access token
   - Copy the token for later use

2. **Figma File Key**

   - Open your Figma file in browser
   - Copy the key from URL: `figma.com/file/YOUR_FILE_KEY/...`

3. **Figma Color Objects**

![Image](https://github.com/user-attachments/assets/1c0fe845-9bc5-4977-869d-67951f5be008)

- Name your color objects with `--` prefix (e.g., `--primary-500`, `--orange-600`)
- You can also use grouped palette structures (e.g., `Neutral` group + numeric shade labels like `0`, `5`, `10`) and Figmable will generate variable names such as `--neutral-0`
- Example:
  ```
  --primary-500  →  #3B82F6
  --orange-600   →  #EA580C
  --neutral-900  →  #171717
  ```

4. **CSS File**

   - Must have `:root` selector in your CSS
   - Example:

     ```css
     /* With Tailwind */
     @layer base {
       :root {
         /* Your CSS variables will be added here */
         --primary: #000000;
       }
     }

     /* Or without Tailwind, simple CSS is fine too */
     :root {
       /* Your CSS variables will be added here */
       --primary: #000000;
     }
     ```

## Installation

```bash
npm install -g figmable
```

## Usage

### 1. Save Configuration

First, save your Figma credentials and file paths:

```bash
figmable config \
  --fileKey YOUR_FIGMA_FILE_KEY \
  --token YOUR_FIGMA_API_TOKEN \
  --path ./path/to/your/global.css
```

### 2. View Current Configuration

Check your saved configuration:

```bash
figmable show
```

This will display:

- Figma file key and URL
- API token
- File paths
- Configuration file location (which you can edit directly)

### 3. Sync Variables

After configuration, simply run:

```bash
figmable
```

This will:

1. Fetch color variables from your Figma file
2. Save them to `figma-variables.json`
3. Update your CSS file
4. Create a backup of your CSS file (`.bak`)

### Advanced Usage

Override configuration for a single run:

```bash
figmable \
  --fileKey DIFFERENT_KEY \
  --token DIFFERENT_TOKEN \
  --path ./different/path.css \
  --output ./different/variables.json
```

Disable backup file creation:

```bash
figmable --no-backup
# or
figmable -nb
```

Enable backup file creation (default behavior):

```bash
figmable --backup
# or just
figmable
```

## File Structure

- `.figmablerc`: Configuration file (automatically created in home directory)
- `figma-variables.json`: Extracted Figma variables (created in project directory)
- `your-css-file.css.bak`: Backup file (created alongside CSS file)

## Error Handling

Figmable provides clear error messages for common issues:

- Invalid Figma API token
- File access permissions
- Missing or invalid file paths
- JSON parsing errors
- CSS file modification errors

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Byungsker

## 한국어

Figmable은 Figma 디자인 파일에서 색상 변수를 CSS 파일로 직접 동기화하는 CLI 도구입니다. Figma에서 색상 변수를 추출하고 새로운 색상 변수로 CSS 파일을 자동으로 업데이트하여 디자인-개발 워크플로우를 원활하게 만듭니다.

## NPM 링크

[npm에서 figmable 보기](https://www.npmjs.com/package/figmable)
