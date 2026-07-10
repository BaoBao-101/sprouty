# Assets, Entitlements, Videos, and Blog

## Models

New Prisma models:

- `Asset`: shared upload record for local or S3-backed files.
- `InstructionVideo` and `UserVideoProgress`: product instruction videos and customer watch progress.
- `UserProductImage`: customer image gallery per purchased or entitled product.
- `RedeemCode`, `RedeemCodeRedemption`, `UserEntitlement`: hashed redeem codes and feature access grants.
- `BlogPost`: public/admin blog content.

`Product.videos` remains as JSON for backward compatibility. Use `npm run videos:migrate -- --dry-run` before converting legacy JSON video entries into `InstructionVideo` rows.

## Routes

Customer:

- `GET /api/v1/products/:productId/videos`
- `GET /api/v1/videos/:videoId`
- `POST /api/v1/videos/:videoId/progress`
- `GET /api/v1/my-products/:productId/images`
- `POST /api/v1/my-products/:productId/images`
- `PATCH /api/v1/my-images/:imageId`
- `DELETE /api/v1/my-images/:imageId`
- `POST /api/v1/redeem`
- `GET /api/v1/me/entitlements`
- `GET /api/v1/blog`
- `GET /api/v1/blog/:slug`

Admin/employee:

- `GET|POST /api/v1/admin/products/:productId/videos`
- `PUT|DELETE /api/v1/admin/videos/:videoId`
- `POST /api/v1/admin/videos/:videoId/upload-thumbnail`
- `GET /api/v1/admin/user-images`
- `PATCH /api/v1/admin/user-images/:imageId/status`
- `GET|POST|PATCH|DELETE /api/v1/admin/redeem-codes`
- `GET /api/v1/admin/redeem-codes/:id/redemptions`
- `GET|POST|PUT|DELETE /api/v1/admin/blog`
- `PATCH /api/v1/admin/blog/:id/status`
- `POST /api/v1/admin/blog/:id/cover`

All browser mutations require `X-CSRF-Token`. Customer resources use `requireAuth`; employee/admin upload and moderation routes use `requireEmployee`; redeem code administration uses `requireAdmin`.

## Entitlement Rules

Product feature access is granted when any of these are true:

- The user is an employee/admin.
- The user has a non-cancelled order with `paidAt` set and an `OrderItem` for the product.
- The user has an active `UserEntitlement` for the requested feature, globally or scoped to the product.

Features are `ai_assistant`, `instruction_videos`, and `image_uploads`. AI remains backward compatible unless `AI_REQUIRES_ENTITLEMENT=true`.

Redeem codes are normalized, SHA-256 hashed, and stored only as `codeHash`. Plaintext codes are returned only from the admin creation response.

## Storage

Local mode is the default:

```env
ASSET_STORAGE_PROVIDER=local
LOCAL_UPLOAD_DIR=uploads
PUBLIC_ASSET_BASE_URL=/uploads
MAX_IMAGE_UPLOAD_MB=10
MAX_VIDEO_UPLOAD_MB=500
```

S3-compatible mode:

```env
ASSET_STORAGE_PROVIDER=s3
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
```

Use `npm run assets:migrate-s3 -- --dry-run` before migrating local `Asset` rows to S3.

## Manual Test Checklist

- Customer cannot view videos for products they did not buy.
- Customer can view videos for paid purchased products.
- Customer can view videos after redeeming `instruction_videos`.
- Customer cannot upload product images without purchase or `image_uploads`.
- Customer can upload/list/rename/delete their own images.
- Customer cannot modify another user image.
- Admin can create redeem codes and see redemptions.
- Redeem max uses and per-user limit are enforced.
- Expired/disabled codes fail.
- AI chat is blocked only when `AI_REQUIRES_ENTITLEMENT=true` and the user lacks `ai_assistant`.
- AI chat works after redeeming `ai_assistant`.
- Employee/admin can create/archive videos and upload thumbnails.
- Public blog only lists published posts.
- Draft blog posts are visible in admin only.
- Local mode stores assets under `LOCAL_UPLOAD_DIR` and serves `/uploads/...`.
- S3 mode uploads new assets to S3 and stores public/signed URLs.
