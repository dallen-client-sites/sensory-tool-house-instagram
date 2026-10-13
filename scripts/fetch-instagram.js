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
 *   POST_LIMIT     - number of posts to fetch (default 8)
 *   OUTPUT_PATH    - where to write the JSON
 */

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.IG_PAGE_TOKEN;
const USER_ID = process.env.IG_USER_ID;
const LIMIT = parseInt(process.env.POST_LIMIT || '8', 10);
const API_VERSION = process.env.GRAPH_API_VERSION || 'v26.0';
const OUTPUT = process.env.OUTPUT_PATH ||
  path.join(__dirname, '..', 'data', 'instagram-feed.json');

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
    `?fields=${fields}&limit=${LIMIT}&access_token=${TOKEN}`;

  const data = await getJson(url);
  return (data.data || [])
    .slice(0, LIMIT)
    .map((p) => ({
      id: p.id,
      caption: p.caption || '',
      image_url: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url,
      permalink: p.permalink,
      media_type: p.media_type,
      timestamp: p.timestamp,
    }))
    .filter((p) => p.image_url && p.permalink);
}

(async () => {
  try {
    const posts = await fetchPosts();

    if (posts.length === 0) {
      throw new Error('API returned no usable posts. Keeping the previous feed file.');
    }

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
