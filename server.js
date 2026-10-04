import express from 'express';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const publicDirectory = path.join(__dirname, 'public');
const indexFile = path.join(__dirname, 'index.html');

if (!existsSync(indexFile)) {
  console.error('Cannot start server: root index.html is missing. Run "npm run build" first.');
  process.exit(1);
}

app.use('/public', express.static(publicDirectory));

app.get('*', (req, res) => {
  res.sendFile(indexFile);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VN Insight AI server running on http://0.0.0.0:${PORT}`);
});
