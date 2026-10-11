#!/usr/bin/env node
/**
 * fetch-instagram.js
 *
 * Pulls the latest posts from the @sensorytoolhouse Instagram Business
 * account and writes them to ../data/instagram-feed.json.
 *
 * Uses the "Instagram API with Instagram Login" flow:
 *   - Token refresh:  GET https://graph.instagram.com/refresh_access_token
 *   - Fetch media:    GET https://graph.instagram.com/me/media
 *
 * Required env vars:
 *   IG_LONG_LIVED_TOKEN  - long-lived token from Instagram Login setup
 *   IG_USER_ID           - Instagram user ID (use "me" for Instagram Login tokens)
 *
 * Optional:
 *   POST_LIMIT           - number of posts to fetch (default 4)
 *   OUTPUT_PATH          - where to write the JSON
 */

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.IG_LONG_LIVED_TOKEN;
const USER_ID = process.env.IG_USER_ID || 'me';
const LIMIT = parseInt(process.env.POST_LIMIT || '4', 10);
const OUTPUT = process.env.OUTPUT_PATH ||
  path.join(__dirname, '..', 'data', 'instagram-feed.json');

if (!TOKEN) {
  console.error('Missing IG_LONG_LIVED_TOKEN environment variable.');
  process.exit(1);
}

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(
      `Graph API ${res.status}: ${body.error ? body.error.message : res.statusText}`
    );
  }
  return body;
}

async function refreshToken(token) {
  const url =
    `https://graph.instagram.com/refresh_access_token` +
    `?grant_type=ig_refresh_token` +
    `&access_token=${token}`;
  try {
    const data = await getJson(url);
    return data.access_token || null;
  } catch (err) {
    console.warn(`Token refresh failed (will continue with current token): ${err.message}`);
    return null;
  }
}

async function fetchPosts(token) {
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
    `https://graph.instagram.com/${USER_ID}/media` +
    `?fields=${fields}&limit=${LIMIT}&access_token=${token}`;

  const data = await getJson(url);
  return (data.data || []).slice(0, LIMIT).map((p) => ({
    id: p.id,
    caption: p.caption || '',
    image_url: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url,
    permalink: p.permalink,
    media_type: p.media_type,
    timestamp: p.timestamp,
  }));
}

(async () => {
  try {
    const refreshed = await refreshToken(TOKEN);
    const tokenToUse = refreshed || TOKEN;

    const posts = await fetchPosts(tokenToUse);

    const payload = {
      generated_at: new Date().toISOString(),
      account: '@sensorytoolhouse',
      count: posts.length,
      posts,
    };

    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2));
    console.log(`Wrote ${posts.length} posts to ${OUTPUT}`);

    if (refreshed && refreshed !== TOKEN) {
      console.log(`::add-mask::${refreshed}`);
      console.log(`NEW_TOKEN=${refreshed}`);
    }
  } catch (err) {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
  }
})();
