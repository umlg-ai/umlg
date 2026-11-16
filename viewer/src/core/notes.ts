export interface NoteEntry {
  elementId: string;
  text: string;
  updatedAt: string;
}

export interface NotesDocument {
  notesVersion: "0.1";
  modelId: string;
  notes: NoteEntry[];
}

export interface NotesParseResult {
  document?: NotesDocument;
  error?: string;
}

export function formatNotesCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} заметка`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} заметки`;
  return `${count} заметок`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseNotesDocument(modelId: string, raw: unknown): NotesParseResult {
  if (!isRecord(raw)) {
    return { error: "Файл заметок должен быть JSON-объектом" };
  }
  if (typeof raw.modelId !== "string" || !raw.modelId) {
    return { error: "В файле заметок нет modelId" };
  }
  if (raw.modelId !== modelId) {
    return {
      error: `Файл относится к модели '${raw.modelId}', а сейчас открыта '${modelId}'`,
    };
  }
  if (!Array.isArray(raw.notes)) {
    return { error: "В файле заметок нет массива notes" };
  }

  const notes = new Map<string, NoteEntry>();
  for (const [index, item] of raw.notes.entries()) {
    if (!isRecord(item)) {
      return { error: `notes[${index}] должен быть объектом` };
    }
    if (typeof item.elementId !== "string" || !item.elementId.trim()) {
      return { error: `notes[${index}].elementId должен быть непустой строкой` };
    }
    if (typeof item.text !== "string") {
      return { error: `notes[${index}].text должен быть строкой` };
    }
    const text = item.text.trim();
    if (!text) continue;
    const elementId = item.elementId.trim();
    notes.set(elementId, {
      elementId,
      text,
      updatedAt:
        typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
    });
  }

  return {
    document: {
      notesVersion: "0.1",
      modelId,
      notes: [...notes.values()],
    },
  };
}
