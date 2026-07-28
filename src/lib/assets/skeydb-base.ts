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

/** Pin to a specific SKeyDB commit so source paths stay stable. */
export const SKEYDB_COMMIT = "dfa2cee539ce3d03344999cfb002fe1a87e9030a";

const SKEYDB_ASSET_ROOT = `https://raw.githubusercontent.com/dansa/SKeyDB/${SKEYDB_COMMIT}/src/assets`;

/** Build a raw.githubusercontent.com URL under SKeyDB `src/assets/`. */
export function assetUrl(relativePath: string): string {
  const cleaned = relativePath.replace(/^\/+/, "").replace(/^src\/assets\//, "");
  return `${SKEYDB_ASSET_ROOT}/${cleaned}`;
}
