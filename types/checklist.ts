// MarkItDone v2.0 — Checklist Types
// A Checklist is a reusable, named list of steps (e.g. "Weekly Office
// Cleaning") that sits idle until activated. Once activated, its items can
// be checked off; when the last one is checked (or the user resets it
// early), it goes back to idle, ready to be activated again next time.
// Unlike Task, a checklist isn't tied to a specific day — it only tracks
// whether it's currently in progress and which of its items are checked.

export interface ChecklistItemDef {
  id: string;
  label: string;
}

export interface ChecklistTemplate {
  id: string;
  title: string;
  icon: string;
  items: ChecklistItemDef[];
  isActive: boolean;
  completedItemIds: string[]; // only meaningful while isActive
  activatedAt?: string;
  createdAt: string;
}
