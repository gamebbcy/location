import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const indexPath = path.join(projectRoot, 'dist', 'client', 'index.html');
const builtHtml = await readFile(indexPath, 'utf8');

const moduleMatch = builtHtml.match(
  /<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*><\/script>/i,
);

if (!moduleMatch) {
  throw new Error('未在前端构建产物中找到入口模块');
}

const cssAssets = [
  ...new Set(
    [...builtHtml.matchAll(/["'](\/assets\/[^"']+\.css)["']/g)].map(
      (match) => match[1],
    ),
  ),
];

if (cssAssets.length === 0) {
  throw new Error('未在前端构建产物中找到样式文件');
}

const stylesheetLinks = cssAssets
  .map((href) => `    <link rel="stylesheet" href="${href}">`)
  .join('\n');

const staticHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta name="description" content="朋友之间安全、私密的位置守护工具">
    <link rel="icon" href="/favicon.svg">
    <title>位置守护</title>
${stylesheetLinks}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${moduleMatch[1]}"></script>
  </body>
</html>
`;

await writeFile(indexPath, staticHtml, 'utf8');
console.log('已生成不依赖妙搭平台的静态前端入口');
