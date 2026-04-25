import { del } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-password');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const password = req.headers['x-password'];
  const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD || 'changeme123';

  if (password !== UPLOAD_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }

  try {
    // Read body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());

    if (!body.url) {
      return res.status(400).json({ error: 'No URL provided' });
    }

    await del(body.url, { token: process.env.BLOB_READ_WRITE_TOKEN });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Delete failed: ' + error.message });
  }
}
