# reddit-posts

- **Status:** validated, inactive
- **Revision date:** 2026-08-04
- **Instance workflow ID:** `xrBvjuvnojsvrTTF`

## Purpose

Return the 10 newest posts from a requested subreddit through an n8n webhook. The workflow is read-only and uses the Apify Reddit scraper Actor instead of Reddit OAuth.

## Input

`GET /webhook-test/reddit-posts?subreddit=<name>` while testing in the editor, or the production webhook path while the workflow is active. The `subreddit` query parameter defaults to `n8n`.

## Output

A JSON array of up to 10 newest Reddit posts.

## Required credential

- n8n credential: `Apify temporary test` (`httpHeaderAuth`)
- Header configured in the encrypted n8n credential store: `Authorization: Bearer <Apify token>`

The token value is not included in this artifact or workflow JSON.

## Validation and test

- Strict workflow validation on 2026-08-04: 0 errors, 1 non-blocking webhook-response warning.
- Approved live test completed for `Showerthoughts`; the workflow returned 10 posts from Reddit through Apify.
- The workflow was deactivated after the test and remains inactive.

## Limitations

- The result count is fixed at 10.
- The third-party Actor may use Apify proxy resources and consume Apify credits; review its settings before production use.
- The temporary credential token should be rotated after testing because it was exposed during setup. Update the encrypted n8n credential rather than editing workflow JSON.
