import { list } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let allBlobs = [];
    let cursor = undefined;

    do {
      const result = await list({
        prefix: 'clips/',
        cursor: cursor,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      allBlobs = allBlobs.concat(result.blobs);
      cursor = result.cursor;
    } while (cursor);

    allBlobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    const videos = allBlobs.map(blob => ({
      url: blob.url,
      filename: blob.pathname.replace('clips/', '').replace(/^\d+-/, ''),
      size: blob.size,
      uploaded: blob.uploadedAt,
      path: blob.pathname,
    }));

    return res.status(200).json({ videos });
  } catch (error) {
    console.error('List error:', error);
    return res.status(500).json({ error: 'Failed to list videos: ' + error.message });
  }
}
