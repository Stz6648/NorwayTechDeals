# Norway merchant feed integration plan

Last reviewed: 2026-11-02

## Current production catalogue

The live catalogue is still based on the eBay US marketplace. All 424 active records currently use USD offers. NOK values shown in the UI are exchange-rate conversions only; they are not Norwegian retail prices. Norway delivery is not verified for these listings.

Do not label an exchange-rate conversion as a Norwegian price. Do not mark a listing as deliverable to Norway unless the merchant feed or checkout confirms it.

## Verified Norwegian affiliate candidates

### Proshop NO — Adtraction

Official programme page: https://adtraction.com/no/annonsor/1870470286

The programme page confirms a Norwegian storefront with Norwegian prices, Norwegian customer support and a localized assortment. Publisher participation requires an Adtraction account, an application to Proshop NO and programme approval.

Adtraction's official FAQ says:
- Publisher API access is available with a unique API key from account settings.
- The platform provides APIs for automated data feeds, reporting and tracking links.
- The API key is account-specific.

Official FAQ: https://adtraction.com/no/faq/

Implementation blocker: the production environment does not currently have a confirmed Proshop NO product-feed/API credential or approved product-feed endpoint. Do not invent an endpoint or assume that every programme exposes a complete product feed.

### Acer NO — Awin

Official programme page: https://ui.awin.com/merchant-profile/24784

The public programme page currently lists:
- 5% commission
- 30-day attribution period
- Free standard delivery and returns
- Standard DHL delivery in 3–4 business days
- Paid express delivery in 1–2 business days for NOK 249

Awin product-feed documentation:
- Publisher feed overview: https://help.awin.com/developers/docs/product-feed-publisher-guide-intro
- Publisher feed access: https://help.awin.com/apidocs/for-publishers
- Feed download instructions: https://success.awin.com/s/article/How-can-I-access-a-Product-Feed?language=en_US

Awin says feeds can include product name, description, price, shipping, images and affiliate deep links. Feed access is through the publisher's Toolbox / Create-a-Feed or the feed-list download. The product-feed key is distinct from the Publisher API key.

Implementation blocker: confirm that Acer NO is approved for the publisher account and that its Norwegian feed is available. Awin feed credentials must be stored as a server-side secret; never commit them to the repository or browser code.

## Required normalized offer fields

For every local merchant offer, store:
- merchant name and merchant country
- product ID / SKU / EAN when available
- exact product title and canonical product URL
- affiliate tracking URL
- price as supplied by the merchant, including currency
- availability / stock state
- shipping cost and delivery estimate when supplied
- VAT inclusion status when known
- feed update timestamp
- source feed timestamp
- condition (new / used / refurbished)

Only mark a local price as NOK when the feed itself supplies NOK. Keep exchange-rate estimates in a separate field and label them as estimates.

## Safe import requirements

1. Fetch feeds into a temporary file; never overwrite the production catalogue during download.
2. Normalize merchant data into the existing catalogue schema.
3. Require a valid tracked link, positive price, known currency and product identifier.
4. Validate local stock and shipping data before showing a Norway delivery badge.
5. Deduplicate by GTIN/EAN first, then normalized manufacturer model number.
6. Keep eBay US listings clearly separated from Norwegian merchant offers.
7. Compare like-for-like products only; do not rank different GPU or laptop models by raw price.
8. If a feed is missing, empty, stale or malformed, fail the update and preserve the last known-good catalogue.
9. Run a dry-run report and catalogue validator before any production write.

## Price history / editorial features

Do not publish price-history charts until a reliable feed refresh is running and at least two genuine price observations exist for the same product and merchant. Do not call a listing a popular product without click or sales analytics. Editorial picks require explicit criteria and must disclose marketplace, condition, delivery and price caveats.
