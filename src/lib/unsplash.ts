export async function fetchWordImageBuffer(word: string): Promise<Buffer | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(word)}&per_page=1&orientation=squarish`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Client-ID ${key}` },
  });

  if (!searchRes.ok) return null;

  const data = await searchRes.json();
  const photoUrl: string | undefined = data.results?.[0]?.urls?.small;
  if (!photoUrl) return null;

  const imgRes = await fetch(photoUrl);
  if (!imgRes.ok) return null;

  return Buffer.from(await imgRes.arrayBuffer());
}
