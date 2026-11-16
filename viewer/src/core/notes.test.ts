import { describe, expect, it } from "vitest";
import { formatNotesCount, parseNotesDocument } from "./notes";
import { NotesStore, type NotesStorage } from "../ui/NotesStore";

class MemoryStorage implements NotesStorage {
  readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}

class BrokenStorage implements NotesStorage {
  getItem(): string | null {
    throw new Error("blocked");
  }

  setItem(): void {
    throw new Error("blocked");
  }

  removeItem(): void {
    throw new Error("blocked");
  }
}

const MODEL = "hello-triangle";

describe("parseNotesDocument", () => {
  it("rejects a file for another model", () => {
    const result = parseNotesDocument(MODEL, {
      notesVersion: "0.1",
      modelId: "other-model",
      notes: [],
    });
    expect(result.document).toBeUndefined();
    expect(result.error).toContain("other-model");
  });

  it("drops empty notes and duplicate element ids", () => {
    const result = parseNotesDocument(MODEL, {
      notesVersion: "0.1",
      modelId: MODEL,
      notes: [
        { elementId: "m.program", text: "  first  ", updatedAt: "2026-01-01T00:00:00.000Z" },
        { elementId: "m.program", text: "second" },
        { elementId: "m.shader", text: "   " },
      ],
    });
    expect(result.document?.notes).toHaveLength(1);
    expect(result.document?.notes[0]).toMatchObject({
      elementId: "m.program",
      text: "second",
    });
  });

  it("rejects malformed notes", () => {
    expect(parseNotesDocument(MODEL, null).error).toBeDefined();
    expect(parseNotesDocument(MODEL, { modelId: MODEL }).error).toBeDefined();
    expect(parseNotesDocument(MODEL, { modelId: MODEL, notes: [42] }).error).toBeDefined();
  });
});

describe("formatNotesCount", () => {
  it("uses Russian plural forms", () => {
    expect(formatNotesCount(0)).toBe("0 заметок");
    expect(formatNotesCount(1)).toBe("1 заметка");
    expect(formatNotesCount(2)).toBe("2 заметки");
    expect(formatNotesCount(5)).toBe("5 заметок");
    expect(formatNotesCount(11)).toBe("11 заметок");
    expect(formatNotesCount(21)).toBe("21 заметка");
  });
});

describe("NotesStore", () => {
  it("persists notes per model and restores them", () => {
    const storage = new MemoryStorage();
    const store = new NotesStore(storage);
    store.load(MODEL);

    expect(store.set("m.program", "проверить контракт")).toBe(true);
    expect(store.get("m.program")).toBe("проверить контракт");
    expect(store.size).toBe(1);
    expect(storage.items.has(`umlg:notes:${MODEL}`)).toBe(true);

    const restored = new NotesStore(storage);
    restored.load(MODEL);
    expect(restored.get("m.program")).toBe("проверить контракт");
  });

  it("removes the storage key when the last note is cleared", () => {
    const storage = new MemoryStorage();
    const store = new NotesStore(storage);
    store.load(MODEL);
    store.set("m.program", "note");
    store.set("m.program", "   ");
    expect(store.size).toBe(0);
    expect(storage.items.has(`umlg:notes:${MODEL}`)).toBe(false);
  });

  it("exports a versioned document and rejects a foreign import", () => {
    const store = new NotesStore(new MemoryStorage());
    store.load(MODEL);
    store.set("m.program", "note");

    const document = store.exportDocument();
    expect(document).toMatchObject({ notesVersion: "0.1", modelId: MODEL });
    expect(document.notes).toHaveLength(1);

    const result = store.importDocument({ ...document, modelId: "other" });
    expect("error" in result && result.error).toContain("other");
    expect(store.size).toBe(1);
  });

  it("merges an imported file into local notes", () => {
    const store = new NotesStore(new MemoryStorage());
    store.load(MODEL);
    store.set("m.program", "local");
    store.set("m.shader", "keep");

    const result = store.importDocument({
      notesVersion: "0.1",
      modelId: MODEL,
      notes: [{ elementId: "m.program", text: "imported" }],
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result).toMatchObject({ imported: 1, total: 2, persisted: true });
    expect(store.get("m.program")).toBe("imported");
    expect(store.get("m.shader")).toBe("keep");
  });

  it("stays usable when localStorage is unavailable or corrupt", () => {
    const blocked = new NotesStore(new BrokenStorage());
    blocked.load(MODEL);
    expect(blocked.get("m.program")).toBe("");
    expect(blocked.set("m.program", "note")).toBe(false);
    expect(blocked.get("m.program")).toBe("note");

    const storage = new MemoryStorage();
    storage.setItem(`umlg:notes:${MODEL}`, "{ not json");
    const store = new NotesStore(storage);
    expect(() => store.load(MODEL)).not.toThrow();
    expect(store.size).toBe(0);
  });

  it("does not write without a loaded model", () => {
    const storage = new MemoryStorage();
    const store = new NotesStore(storage);
    expect(store.set("m.program", "note")).toBe(false);
    expect(storage.items.size).toBe(0);
  });
});
