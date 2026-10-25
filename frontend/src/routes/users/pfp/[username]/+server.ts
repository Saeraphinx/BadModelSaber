import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const GITHUB_USERNAME_REGEX = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

export const GET: RequestHandler = async ({ params }) => {
  let { username } = params;

  if (!username) return json({ error: 'No username' }, { status: 400 });
  username = username.toLowerCase().trim();
  username = username.replace(`.png`, ``);
  if (!GITHUB_USERNAME_REGEX.test(username)) return json({ error: 'Invalid username' }, { status: 400 });

  // Fetch the avatar directly from GitHub's servers
  const response = await fetch(`https://github.com/${username}.png`);

  if (!response.ok) {
    return json({ error: 'User not found' }, { status: 404 });
  }

  // Get the image as a buffer
  const imageBuffer = await response.arrayBuffer();

  // Return the image to your frontend with proper headers
  return new Response(imageBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    }
  });
}