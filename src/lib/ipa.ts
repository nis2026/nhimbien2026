/** IPA as displayed: always exactly one pair of slashes, whatever the stored form. */
export function ipaText(ipa: string): string {
  const bare = ipa.trim().replace(/^\/+|\/+$/g, "").trim();
  return bare ? `/${bare}/` : "";
}
