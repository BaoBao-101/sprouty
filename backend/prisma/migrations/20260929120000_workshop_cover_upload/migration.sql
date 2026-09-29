-- Workshop covers are uploaded files now, not a URL typed into a text box, so
-- they need their own asset kind. Public, like blog covers: the workshop page
-- shows them to anyone (see middleware/assetGuard.js).
ALTER TYPE "AssetKind" ADD VALUE IF NOT EXISTS 'workshop_cover';

-- The emoji stood in for a cover image. With a real upload there is nothing for
-- it to do, and two ways to illustrate one session is one too many.
ALTER TABLE "Workshop" DROP COLUMN IF EXISTS "emoji";
