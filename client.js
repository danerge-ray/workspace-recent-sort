window.__ModuleLoader__.load({
  id: '@local/workspace-recent-sort',
  factory(require) {
    /**
     * workspace-recent-sort — client half.
     *
     * WHY: the shipped sidebar (and any plugin that replaces it, such as
     * dsh-better-workspace) sorts SESSIONS inside a workspace by recency for
     * the "Last updated" / 最近更新 view option, but never sorts the WORKSPACE
     * groups themselves. Those groups keep the stored registry order (creation
     * + drag order), so a workspace whose newest session just became the
     * newest session overall can still sit at the bottom of the list.
     *
     * HOW: the Workspace Controller's client face assembles the single
     * snapshot every consumer reads (`buildSnapshot()` -> `items`). Wrapping
     * that method's result lets us reorder the workspace list exactly once,
     * before any surface (shipped browser or a plugin that shadows it) turns
     * it into rows. Nothing here touches another plugin's source, and no slot
     * is shadowed, so this survives upgrades of either the host or any
     * sidebar-replacing plugin.
     *
     * SCOPE: reordering happens only while the active view option is
     * "updated". With "manual" the stored sequence is the user's own drag
     * layout and is returned untouched. The committed registry order is never
     * written: this is a read-side projection only.
     */

    /** Marker so a second activation cannot double-wrap the same instance. */
    const PATCHED = Symbol.for('dsh.workspace-recent-sort.patched')

    /** The persisted view-option key used by the shipped sidebar. */
    const VIEW_STORE_KEY = 'dsh.workspace.view.v5'

    /** The persisted view-option key used by dsh-better-workspace. */
    const BETTER_STORE_KEY = 'dsh.betterWorkspace.view.v1'

    /**
     * Read the active view option without triggering a render.
     * @returns {'updated'|'manual'} the effective ordering mode.
     */
    const readOrderBy = () => {
      const readOne = (key) => {
        try {
          const raw = window.localStorage.getItem(key)
          if (!raw) return null
          const parsed = JSON.parse(raw)
          // Persisted stores wrap their fields in a `state` envelope of some
          // depth depending on the store library revision.
          const state = parsed && (parsed.state ?? parsed)
          const value = state && state.orderBy
          return value === 'updated' || value === 'manual' ? value : null
        } catch (error) {
          return null
        }
      }
      return readOne(VIEW_STORE_KEY) ?? readOne(BETTER_STORE_KEY) ?? 'updated'
    }

    /**
     * Newest session activity time of one workspace.
     * @param workspace - one registry workspace record.
     * @param byId - session summaries keyed by session id.
     * @returns epoch milliseconds, or 0 when nothing is known.
     */
    const workspaceRecencyOf = (workspace, byId) => {
      let latest = 0
      const ids = workspace && Array.isArray(workspace.sessionIds) ? workspace.sessionIds : []
      for (const id of ids) {
        const summary = byId ? byId[id] : undefined
        const at = summary && typeof summary.updatedAt === 'number' ? summary.updatedAt : 0
        if (at > latest) latest = at
      }
      if (latest === 0 && workspace && workspace.createdAt) {
        const created = Date.parse(workspace.createdAt)
        if (!Number.isNaN(created)) latest = created
      }
      return latest
    }

    /**
     * Reorder workspaces by their newest session, newest first.
     * @param items - workspace records in stored order.
     * @param byId - session summaries keyed by session id, or null when unknown.
     * @returns a new array; the input is never mutated.
     */
    const orderWorkspacesByRecency = (items, byId) => {
      const list = items || []
      if (list.length < 2) return list
      const ranked = list.map((workspace, index) => ({
        workspace,
        index,
        at: workspaceRecencyOf(workspace, byId),
      }))
      // With fewer than two usable timestamps the stored order is the only
      // meaningful sequence; reordering would be arbitrary.
      let stamped = 0
      for (const row of ranked) if (row.at > 0) stamped += 1
      if (stamped < 2) return list
      ranked.sort((a, b) => (b.at - a.at) || (a.index - b.index))
      return ranked.map((row) => row.workspace)
    }

    /**
     * Wrap the Workspace state model so its published snapshot carries
     * recency-ordered `items` whenever the view option asks for it.
     *
     * Two details decide where to patch:
     *
     *  - The `workspaces` Service is a thin command facade; the state model
     *    that owns the snapshot is reachable through its `list` face
     *    (`WorkspaceController.list === model`), the same object every
     *    consumer subscribes to.
     *  - The model caches its snapshot behind a `snapshotDirty` flag, rebuilt
     *    only when Workspace data itself changes. Reordering workspaces is
     *    NOT a Workspace-data change, so patching `buildSnapshot` would leave
     *    a stale order in the cache after the user switches view options.
     *    Patching `getSnapshot` instead re-projects on every read (React's
     *    snapshot comparison keeps that cheap and correct).
     *
     * @param controller - the `ctx.workspaces` client service instance.
     * @param getSessions - reads the live session summary map.
     * @returns true when this call patched a model.
     */
    const patchController = (controller, getSessions) => {
      if (!controller) return false
      const candidates = [controller.list, controller.model, controller]
      for (const model of candidates) {
        if (!model || typeof model.getSnapshot !== 'function') continue
        if (model[PATCHED]) return true
        const original = model.getSnapshot

        // React's useSyncExternalStore requires getSnapshot to return the SAME
        // reference while nothing changed, or it re-renders forever. The host
        // model's snapshot is stable, but our reordered wrapper is a new object
        // every call — so remember the last projection and reuse it while its
        // inputs (source snapshot, view option, ordered ids) are unchanged.
        let cacheSource = null
        let cacheMode = null
        let cacheOrderKey = ''
        let cacheResult = null

        Object.defineProperty(model, PATCHED, { value: true, enumerable: false })
        model.getSnapshot = function getSnapshotOrderedByRecency(...args) {
          const snapshot = original.apply(this, args)
          try {
            if (!snapshot || !Array.isArray(snapshot.items)) return snapshot
            const mode = readOrderBy()
            if (mode !== 'updated') {
              cacheSource = null
              return snapshot
            }
            const ordered = orderWorkspacesByRecency(snapshot.items, getSessions().byId)
            if (ordered === snapshot.items) {
              cacheSource = null
              return snapshot
            }
            const orderKey = ordered.map((workspace) => workspace?.workspaceId ?? '').join('\u0000')
            if (cacheResult !== null && cacheSource === snapshot && cacheMode === mode && cacheOrderKey === orderKey) {
              return cacheResult
            }
            cacheSource = snapshot
            cacheMode = mode
            cacheOrderKey = orderKey
            cacheResult = { ...snapshot, items: ordered }
            return cacheResult
          } catch (error) {
            // Never break the sidebar because a reorder failed.
            return snapshot
          }
        }
        return true
      }
      return false
    }

    return {
      name: '@local/workspace-recent-sort',
      inject: ['workspaces'],

      apply(ctx) {
        // `sessions` is optional: without it no timestamps exist and the
        // stored order simply stays as-is.
        const sessions = ctx.get('sessions')
        const controller = ctx.get('workspaces')
        if (!controller) return

        const getSessions = () => {
          try {
            const snapshot = sessions && typeof sessions.list === 'object' ? sessions.list.getSnapshot() : null
            return snapshot && snapshot.byId ? snapshot : { byId: null }
          } catch (error) {
            return { byId: null }
          }
        }

        // The controller may already be live when this plugin activates, or
        // it may arrive later. Patch eagerly, and retry on service change.
        patchController(controller, getSessions)

        // The controller may already be live when this plugin activates, or
        // it may arrive later. Patch eagerly, and re-apply through the Cordis
        // inject channel if the service is ever replaced.
        patchController(controller, getSessions)

        ctx.effect(() => {
          const dispose = ctx.inject(['workspaces'], (child) => {
            try {
              patchController(child.get('workspaces'), getSessions)
            } catch (error) {
              /* service not ready yet */
            }
          })
          return () => {
            if (typeof dispose === 'function') dispose()
          }
        }, 'workspace-recent-sort: controller patch')
      },
    }
  },
})
