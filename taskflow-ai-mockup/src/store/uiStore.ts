import { create } from 'zustand'

interface UIStore {
  collapsedGroups: Set<string>
  toggleGroup: (groupId: string) => void
  isGroupCollapsed: (groupId: string) => boolean
}

export const useUIStore = create<UIStore>((set, get) => ({
  collapsedGroups: new Set(),

  toggleGroup: (groupId) =>
    set((state) => {
      const next = new Set(state.collapsedGroups)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return { collapsedGroups: next }
    }),

  isGroupCollapsed: (groupId) => get().collapsedGroups.has(groupId),
}))
