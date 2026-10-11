# Sensory Tool House Instagram feed

A daily-refreshed Instagram carousel for sensorytoolhouse.com.

1. A GitHub Actions job runs every day at 6:00 UTC, calls the Instagram API and commits fresh post data to `data/instagram-feed.json`.
2. The Shopify store reads that JSON from `raw.githubusercontent.com`. No tokens or API calls run in the browser.
3. A Liquid section renders the posts as a swipeable carousel. If the feed ever fails, the section hides itself instead of showing an error.

## Files

- `shopify/custom-liquid/instagram-feed-custom-liquid.liquid`: paste into a Custom liquid section (works in Pebble and Eurus, no code editor needed). Set `feed_url` at the top.
- `shopify/sections/instagram-feed.liquid`: full theme section with editor settings (needs the theme code editor, available on the live Eurus theme).
- `scripts/fetch-instagram.js`, `scripts/package.json`: the fetch script.
- `.github/workflows/instagram-feed.yml`: the daily job.
- `data/instagram-feed.json`: starts empty, filled by the job.

## Feed URL

`https://raw.githubusercontent.com/dallen-client-sites/sensory-tool-house-instagram/main/data/instagram-feed.json`

The repo must stay public for this URL to work.

See SETUP-INSTAGRAM-API.md for the one-time setup.
