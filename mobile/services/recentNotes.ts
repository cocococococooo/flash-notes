import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENT_NOTES_KEY = "@recent_notes";
const MAX_RECENT_NOTES = 3;

interface RecentNote {
  noteId: number;
  projectId: number;
  title: string;
  timestamp: number;
  imageCount: number;
}

export async function getRecentNotes(): Promise<RecentNote[]> {
  try {
    const data = await AsyncStorage.getItem(RECENT_NOTES_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data) as any[];
    const list = parsed.map((n) => ({
      noteId: n.noteId ?? n.id ?? 0,
      projectId: n.projectId ?? n.id ?? 0,
      title: n.title || "笔记",
      timestamp: n.timestamp || 0,
      imageCount: typeof n.imageCount === "number" ? n.imageCount : 0,
    }));
    const trimmed = list.slice(0, MAX_RECENT_NOTES);
    if (trimmed.length !== list.length) {
      await AsyncStorage.setItem(RECENT_NOTES_KEY, JSON.stringify(trimmed));
    }
    return trimmed;
  } catch (e) {
    console.error("Failed to load recent notes:", e);
    return [];
  }
}

export async function addRecentNote(
  noteId: number,
  projectId: number,
  title: string,
  imageCount: number = 0
): Promise<void> {
  try {
    const recent = await getRecentNotes();
    const filtered = recent.filter((n) => n.noteId !== noteId);
    const updated = [
      { noteId, projectId, title, timestamp: Date.now(), imageCount },
      ...filtered,
    ].slice(0, MAX_RECENT_NOTES);
    await AsyncStorage.setItem(RECENT_NOTES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save recent note:", e);
  }
}

export async function clearRecentNotes(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_NOTES_KEY);
  } catch (e) {
    console.error("Failed to clear recent notes:", e);
  }
}
