import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENT_NOTES_KEY = "@recent_notes";
const MAX_RECENT_NOTES = 10;

interface RecentNote {
  id: number;
  title: string;
  timestamp: number;
}

export async function getRecentNotes(): Promise<RecentNote[]> {
  try {
    const data = await AsyncStorage.getItem(RECENT_NOTES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load recent notes:", e);
    return [];
  }
}

export async function addRecentNote(noteId: number, title: string): Promise<void> {
  try {
    const recent = await getRecentNotes();
    const filtered = recent.filter((n) => n.id !== noteId);
    const updated = [
      { id: noteId, title, timestamp: Date.now() },
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
