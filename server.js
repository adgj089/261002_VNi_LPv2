import express from 'express';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const distDirectory = path.join(__dirname, 'dist');
const distIndex = path.join(distDirectory, 'index.html');

if (!existsSync(distIndex)) {
  console.error('Cannot start server: dist/index.html is missing. Run "npm run build" first.');
  process.exit(1);
}

app.use(express.static(distDirectory));

app.get('*', (req, res) => {
  res.sendFile(distIndex);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VN Insight AI server running on http://0.0.0.0:${PORT}`);
});
