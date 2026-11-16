import { parseNotesDocument, type NoteEntry, type NotesDocument } from "../core/notes";

const KEY_PREFIX = "umlg:notes:";

/** The subset of Web Storage used by the notes store; keeps it testable in Node. */
export interface NotesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface NotesImportResult {
  imported: number;
  total: number;
  persisted: boolean;
}

function toMap(document: NotesDocument): Map<string, NoteEntry> {
  return new Map(document.notes.map((note) => [note.elementId, note]));
}

/**
 * Viewer-local notes: stored in localStorage per model id, never in model.json.
 * Every write is best-effort; callers get `false` when the browser rejects it.
 */
export class NotesStore {
  private readonly storage: NotesStorage | null;
  private modelId = "";
  private notes = new Map<string, NoteEntry>();

  constructor(storage: NotesStorage | null) {
    this.storage = storage;
  }

  get storageAvailable(): boolean {
    return this.storage !== null;
  }

  get activeModelId(): string {
    return this.modelId;
  }

  get size(): number {
    return this.notes.size;
  }

  load(modelId: string): void {
    this.modelId = modelId;
    this.notes = new Map();
    if (!this.storage || !modelId) return;

    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.storageKey);
    } catch {
      return;
    }
    if (!raw) return;

    try {
      const result = parseNotesDocument(modelId, JSON.parse(raw) as unknown);
      if (result.document) this.notes = toMap(result.document);
    } catch {
      // Corrupt local data must not break the viewer; start with an empty set.
    }
  }

  get(elementId: string): string {
    return this.notes.get(elementId)?.text ?? "";
  }

  has(elementId: string): boolean {
    return this.notes.has(elementId);
  }

  set(elementId: string, text: string): boolean {
    const trimmed = text.trim();
    const existing = this.notes.get(elementId);
    if (!trimmed) {
      if (!existing) return true;
      this.notes.delete(elementId);
      return this.persist();
    }
    if (existing?.text === trimmed) return true;
    this.notes.set(elementId, {
      elementId,
      text: trimmed,
      updatedAt: new Date().toISOString(),
    });
    return this.persist();
  }

  exportDocument(): NotesDocument {
    return {
      notesVersion: "0.1",
      modelId: this.modelId,
      notes: [...this.notes.values()].sort((a, b) => a.elementId.localeCompare(b.elementId)),
    };
  }

  /**
   * Merges a notes file into the local set. Imported entries win for the same
   * element; local notes for other elements are kept.
   */
  importDocument(raw: unknown): NotesImportResult | { error: string } {
    const result = parseNotesDocument(this.modelId, raw);
    if (!result.document) {
      return { error: result.error ?? "Не удалось прочитать файл заметок" };
    }

    let imported = 0;
    for (const note of result.document.notes) {
      if (this.notes.get(note.elementId)?.text !== note.text) imported += 1;
      this.notes.set(note.elementId, note);
    }
    return {
      imported,
      total: this.notes.size,
      persisted: this.persist(),
    };
  }

  private get storageKey(): string {
    return `${KEY_PREFIX}${this.modelId}`;
  }

  private persist(): boolean {
    if (!this.storage || !this.modelId) return false;
    try {
      if (this.notes.size === 0) {
        this.storage.removeItem(this.storageKey);
      } else {
        this.storage.setItem(this.storageKey, JSON.stringify(this.exportDocument()));
      }
      return true;
    } catch {
      return false;
    }
  }
}
