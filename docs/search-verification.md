# Search ownership and sitemap runbook

Use this during **PR 8**, after the immutable Cloudflare Pages preview passes and before declaring the apex cutover complete. This runbook prepares verification and submission; it does not claim search-engine acceptance or ranking.

## Preconditions

1. Record the deployed commit and immutable preview URL.
2. Confirm these return `200` from the preview artifact:
   - `/robots.txt`
   - `/sitemap.xml`
   - `/llms.txt`
   - `/llms-full.txt`
3. Run the repository metadata and link checks against the same commit.
4. Confirm the production sitemap contains only canonical, indexable pages and uses `https://ggts.sh`.

## Google Search Console domain property

1. Add the Domain property `ggsvelte.sh` in Google Search Console.
2. Copy the exact `google-site-verification=…` TXT value shown by Search Console.
3. Snapshot the current Cloudflare DNS record set before changing it.
4. Add that value as a DNS TXT record at the zone apex. Do not place the token in this repository.
5. Wait for public DNS propagation, then verify the exact value from at least two resolvers:

   ```sh
   dig +short TXT ggsvelte.sh @1.1.1.1
   dig +short TXT ggsvelte.sh @8.8.8.8
   ```

6. Complete ownership verification in Search Console and record the timestamp and property type.
7. After the apex is healthy, submit `https://ggts.sh/sitemap.xml` in the Sitemaps report.
8. Record submission acknowledgement, last-read status, discovered URL count, and any parser errors as separate fields.

## Bing Webmaster Tools

1. Add `https://ggts.sh` in Bing Webmaster Tools.
2. Prefer importing the already verified Search Console property. If import is unavailable, use Bing's DNS verification value and follow the same snapshot, TXT, propagation, and secret-handling steps above.
3. Submit `https://ggts.sh/sitemap.xml` only after the apex route and certificate checks pass.
4. Record ownership verification, submission acknowledgement, fetch status, discovered URLs, and reported errors separately.

## Post-submission checks

From a fresh client and without a logged-in browser session:

```sh
curl --fail --silent --show-error --location https://ggts.sh/ >/dev/null
curl --fail --silent --show-error https://ggts.sh/robots.txt
curl --fail --silent --show-error https://ggts.sh/sitemap.xml
curl --fail --silent --show-error https://ggts.sh/llms.txt | head
```

Inspect the home page, Getting Started, one gallery detail, Themes, and Reference in both webmaster tools. Track these states independently:

- property ownership verified;
- sitemap submitted;
- sitemap fetched and parsed;
- URL discovered;
- URL crawled;
- URL indexed.

**Submission is not evidence of indexing.** Do not report indexing success until the engine reports the exact canonical URL as indexed. Ranking is a later observation, not a cutover acceptance gate.

## Rollback

If PR 8 rolls the apex back, leave ownership TXT records in place unless they interfere with recovery. Stop new sitemap submissions, restore the recorded DNS/Pages configuration, identify the last healthy deployment, and repeat the route, canonical, certificate, and sitemap checks before resuming submission work.
