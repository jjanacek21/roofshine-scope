/**
 * Feature keys for the main navigation items. Shared by the desktop sidebar,
 * mobile sheet and bottom tabs so all three stay in sync.
 */
export const NAV_FEATURE: Record<string, string> = {
  "/": "crm.dashboard",
  "/clients": "crm.clients",
  "/jobs": "crm.jobs",
  "/leads": "commercial.prospecting",
  "/door-to-door": "door_to_door",
  "/storm-intelligence": "storm_intel",
  "/claim-buddy": "claim_buddy",
  "/card": "my_card",
  "/survival-guide": "survival_guide",
  "/roofking": "commercial",
};

/**
 * Items that live at top level today but belong inside a module. When the
 * module is granted the item is owned by the module's own navigation, so the
 * top-level entry is hidden (this is how Roof King accounts keep /leads off
 * their sidebar).
 */
export const NAV_HIDE_WHEN: Record<string, string> = {
  "/leads": "commercial",
};

export function navVisible(can: (key: string) => boolean, to: string): boolean {
  const feature = NAV_FEATURE[to];
  const hideWhen = NAV_HIDE_WHEN[to];
  if (hideWhen) {
    // Owned by the module once the module is granted; otherwise it stays at
    // top level for everyone (this is today's behavior).
    return !can(hideWhen);
  }
  if (!feature) return true;
  return can(feature);
}
