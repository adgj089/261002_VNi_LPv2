import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const paths = {
  html: path.join(projectRoot, 'index.html'),
  css: path.join(projectRoot, 'src', 'ai-chat.css'),
  javascript: path.join(projectRoot, 'src', 'ai-chat.js'),
  image: path.join(projectRoot, 'public', 'scattered_data_cards.webp'),
  outputDirectory: path.join(projectRoot, 'dist'),
  output: path.join(projectRoot, 'dist', 'index.html'),
};

try {
  const [html, css, javascript, image] = await Promise.all([
    readFile(paths.html, 'utf8'),
    readFile(paths.css, 'utf8'),
    readFile(paths.javascript, 'utf8'),
    readFile(paths.image),
  ]);

  if (!html.includes('</head>')) {
    throw new Error('Root index.html is missing the required </head> closing tag.');
  }
  if (!html.includes('</body>')) {
    throw new Error('Root index.html is missing the required </body> closing tag.');
  }

  const styleTag = `<style id="vn-ai-chat-styles">\n${css}\n</style>`;
  const scriptTag = `<script id="vn-ai-chat-script">\n${javascript}\n</script>`;
  const imageDataUri = `data:image/webp;base64,${image.toString('base64')}`;
  const withStyles = html.replace('</head>', `${styleTag}\n</head>`);
  const withScript = withStyles.replace('</body>', `${scriptTag}\n</body>`);
  const outputHtml = withScript.replaceAll(
    './public/scattered_data_cards.webp',
    imageDataUri,
  );

  await mkdir(paths.outputDirectory, { recursive: true });
  await writeFile(paths.output, outputHtml, 'utf8');
  console.log(`Built ${path.relative(projectRoot, paths.output)}`);
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
}
