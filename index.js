/**
 * Host half of the workspace-recent-sort bundle.
 *
 * The capability is purely a Client-side read projection (the sidebar's
 * workspace list is assembled in the browser), so this entry only exists to
 * make the bundle addressable in Plugin Manager, exposing the on/off switch
 * that cordis.patch.yml carries.
 */
export function apply(ctx, config) {
  const enabled = config?.enabled !== false
  if (!enabled) return
  // No Host-side resources: see client.js for the reordering itself.
}
