import { json } from '@sveltejs/kit';

export async function GET({ params }) {
  const { username } = params;

  // Fetch the avatar directly from GitHub's servers
  const response = await fetch(`https://github.com/${username}`);

  if (!response.ok) {
    return json({ error: 'User not found' }, { status: 404 });
  }

  // Get the image as a buffer
  const imageBuffer = await response.arrayBuffer();

  // Return the image to your frontend with proper headers
  return new Response(imageBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    }
  });
}