# One-time setup (about 20 minutes)

Needs: the Instagram account set to Business or Creator, linked to the Facebook Page, plus Meta developer and GitHub logins. The account owner must accept the app's tester invite.

## 1. Meta developer app
1. developers.facebook.com, My Apps, Create App. Use case "Other", type "Business". Name: "Sensory Tool House Social Feed".
2. Use Cases, add "Manage messaging & content on Instagram", then Customize.
3. Open the tab "API setup with Instagram login" (not the Facebook login tab).
4. Add the sensorytoolhouse account as an Instagram tester, accept the invite in Instagram (Settings, Website permissions, Tester invites).
5. Under "Generate access tokens", click "Generate token" next to sensorytoolhouse and authorize. Copy the token (starts with IGAA).
6. Do not exchange the token and do not use Graph API Explorer.

## 2. GitHub secrets
Settings, Secrets and variables, Actions, add:
- IG_LONG_LIVED_TOKEN: the token from step 1
- IG_USER_ID: the word `me`
- GH_PAT_FOR_SECRETS (optional): a personal access token with repo scope so the job can rotate the token automatically

Then Actions, Refresh Instagram Feed, Run workflow. Open "Fetch latest posts": it should say "Wrote N posts."

## 3. Shopify
1. In the theme editor, add a Custom liquid section above the trust band.
2. Paste shopify/custom-liquid/instagram-feed-custom-liquid.liquid. The feed URL is already set.
3. Check desktop and mobile. Hard refresh if images do not show (the script cache-busts hourly).

## If it stops working
Check the "Fetch latest posts" log, not the green checkmark. "API access blocked" or "Invalid OAuth access token" means regenerate the token and update the secret.
