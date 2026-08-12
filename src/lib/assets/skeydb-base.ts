/**
 * Remote asset URLs for Morimens game art hosted in dansa/SKeyDB.
 *
 * Game assets (portraits, icons, etc.) are owned by Qookka Games and/or their
 * licensors and are not licensed by SKeyDB. Some posse / awakener material was
 * previously sourced via HuijiWiki under CC BY-NC-SA.
 *
 * @see https://github.com/dansa/SKeyDB
 * @see https://github.com/dansa/SKeyDB/blob/main/ASSET-NOTICE.md
 */

/** Pin to a specific SKeyDB commit so source paths stay stable.
 *  Refresh with: npm run sync:skeydb-assets (see docs/admin/updating-skeydb-assets.md). */
export const SKEYDB_COMMIT = "3d5f0ab8b1580cc9585b44f8697dcdcebc537622";

const SKEYDB_ASSET_ROOT = `https://raw.githubusercontent.com/dansa/SKeyDB/${SKEYDB_COMMIT}/src/assets`;

/** Build a raw.githubusercontent.com URL under SKeyDB `src/assets/`. */
export function assetUrl(relativePath: string): string {
  const cleaned = relativePath.replace(/^\/+/, "").replace(/^src\/assets\//, "");
  return `${SKEYDB_ASSET_ROOT}/${cleaned}`;
}
