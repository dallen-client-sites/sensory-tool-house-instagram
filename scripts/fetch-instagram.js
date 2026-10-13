#!/usr/bin/env node
/**
 * fetch-instagram.js
 *
 * Pulls the latest posts from the @sensorytoolhouse Instagram professional
 * account and writes them to ../data/instagram-feed.json.
 *
 * Uses the "Instagram API with Facebook Login" flow:
 *   - Fetch media: GET https://graph.facebook.com/v26.0/{ig-user-id}/media
 *   - Auth: a Page access token for the Facebook Page linked to the account.
 *     A Page token made from a long-lived user token does not expire, so there
 *     is no refresh step.
 *
 * Required env vars:
 *   IG_PAGE_TOKEN  - Page access token (stored as a GitHub secret)
 *   IG_USER_ID     - Instagram professional account ID (17841445437380170)
 *
 * Optional:
 *   POST_LIMIT     - number of posts to keep (default 6)
 *   OUTPUT_PATH    - where to write the JSON
 *
 * Also:
 *   - Skips posts listed in EXCLUDE_IDS or matching EXCLUDE_PATTERNS below
 *     (service notices like outage or closure posts should not sit on the
 *     homepage).
 *   - Copies each image into data/images/ so the carousel never depends on
 *     Instagram image links, which expire within hours to days.
 */

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.IG_PAGE_TOKEN;
const USER_ID = process.env.IG_USER_ID;
const LIMIT = parseInt(process.env.POST_LIMIT || '6', 10);
const FETCH_LIMIT = Math.max(LIMIT * 3, 18);
const REPO_RAW_BASE =
  'https://raw.githubusercontent.com/dallen-client-sites/sensory-tool-house-instagram/main/data/images/';

// Add Instagram post IDs here to keep them off the website.
const EXCLUDE_IDS = new Set([
  '18095342363403011', // Sept 25 power and internet outage notice
]);
// Captions matching any of these are skipped (temporary service notices).
const EXCLUDE_PATTERNS = [
  /power and internet outage/i,
  /intermittent power/i,
  /closed (today|tomorrow|early)/i,
  /closing early/i,
];
const API_VERSION = process.env.GRAPH_API_VERSION || 'v26.0';
const OUTPUT = process.env.OUTPUT_PATH ||
  path.join(__dirname, '..', 'data', 'instagram-feed.json');
const IMAGE_DIR = path.join(path.dirname(OUTPUT), 'images');

if (!TOKEN) {
  console.error('Missing IG_PAGE_TOKEN environment variable.');
  process.exit(1);
}
if (!USER_ID) {
  console.error('Missing IG_USER_ID environment variable.');
  process.exit(1);
}

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    const code = body.error ? ` (code ${body.error.code})` : '';
    throw new Error(
      `Graph API ${res.status}${code}: ${body.error ? body.error.message : res.statusText}`
    );
  }
  return body;
}

async function fetchPosts() {
  const fields = [
    'id',
    'caption',
    'media_type',
    'media_url',
    'thumbnail_url',
    'permalink',
    'timestamp',
  ].join(',');

  const url =
    `https://graph.facebook.com/${API_VERSION}/${USER_ID}/media` +
    `?fields=${fields}&limit=${FETCH_LIMIT}&access_token=${TOKEN}`;

  const data = await getJson(url);
  return (data.data || [])
    .map((p) => ({
      id: p.id,
      caption: p.caption || '',
      image_url: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url,
      permalink: p.permalink,
      media_type: p.media_type,
      timestamp: p.timestamp,
    }))
    .filter((p) => p.image_url && p.permalink)
    .filter((p) => !EXCLUDE_IDS.has(p.id))
    .filter((p) => !EXCLUDE_PATTERNS.some((re) => re.test(p.caption)))
    .slice(0, LIMIT);
}

// Download an image into data/images/<id>.jpg. Returns the stable repo URL,
// or null if the download fails (the caller then keeps the Instagram URL).
async function saveImage(post) {
  try {
    const res = await fetch(post.image_url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) throw new Error('image too small');
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
    fs.writeFileSync(path.join(IMAGE_DIR, `${post.id}.jpg`), buf);
    return `${REPO_RAW_BASE}${post.id}.jpg`;
  } catch (err) {
    console.warn(`Image copy failed for ${post.id}: ${err.message}`);
    return null;
  }
}

function pruneImages(keepIds) {
  if (!fs.existsSync(IMAGE_DIR)) return;
  for (const f of fs.readdirSync(IMAGE_DIR)) {
    if (!keepIds.has(f.replace(/\.jpg$/, ''))) fs.unlinkSync(path.join(IMAGE_DIR, f));
  }
}

(async () => {
  try {
    const posts = await fetchPosts();

    if (posts.length === 0) {
      throw new Error('API returned no usable posts. Keeping the previous feed file.');
    }

    const kept = new Set();
    for (const post of posts) {
      const stable = await saveImage(post);
      if (stable) {
        post.image_url = stable;
        kept.add(post.id);
      }
    }
    pruneImages(kept);

    const payload = {
      generated_at: new Date().toISOString(),
      account: '@sensorytoolhouse',
      count: posts.length,
      posts,
    };

    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2));
    console.log(`Wrote ${posts.length} posts to ${OUTPUT}`);
  } catch (err) {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
  }
})();
