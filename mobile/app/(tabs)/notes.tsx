import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "../../services/api";
import { API_BASE_URL } from "../../constants/config";
import IconPark from "../../components/IconPark";

interface NoteItem {
  id: number;
  projectId: number;
  projectTitle: string;
  content: string;
  tags: string;
  imageCount: number;
  imageUrls: string[];
  updatedAt: string;
}

const FOLDER_COLORS = [
  { start: "#A855F7", end: "#7C3AED" },
  { start: "#F97316", end: "#EA580C" },
  { start: "#3B82F6", end: "#2563EB" },
  { start: "#10B981", end: "#059669" },
  { start: "#EC4899", end: "#DB2777" },
  { start: "#8B5CF6", end: "#6D28D9" },
  { start: "#F59E0B", end: "#D97706" },
  { start: "#06B6D4", end: "#0891B2" },
];

function getFolderColor(id: number) {
  return FOLDER_COLORS[id % FOLDER_COLORS.length];
}

function stripMarkdown(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, "[图片]")
    .replace(/[#*`\[\]]/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

export default function NotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [projectsList, setProjectsList] = useState<{ id: number; title: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadNotes = useCallback(async () => {
    try {
      const notesData = await api.listAllNotes();
      setNotes(notesData);
    } catch (e) {
      console.error("load notes error:", e);
    }
    try {
      const projectsData = await api.listProjects();
      setProjectsList(projectsData);
    } catch (e) {
      console.error("load projects error:", e);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  const handleCreateFolder = async () => {
    const title = newFolderName.trim();
    if (!title) return;
    setCreating(true);
    try {
      const project = await api.createProject(title);
      setProjectsList((prev) => [{ id: project.id, title: project.title, createdAt: project.createdAt }, ...prev]);
      setCreateModalVisible(false);
      setNewFolderName("");
    } catch (e: any) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const projects = useMemo(() => {
    const map = new Map<number, { id: number; title: string; count: number; note: NoteItem | null }>();
    
    projectsList.forEach((project) => {
      map.set(project.id, {
        id: project.id,
        title: project.title || "未命名项目",
        count: 0,
        note: null,
      });
    });
    
    notes.forEach((note) => {
      const existing = map.get(note.projectId);
      if (existing) {
        existing.count++;
        if (!existing.note) {
          existing.note = note;
        }
      } else {
        map.set(note.projectId, {
          id: note.projectId,
          title: note.projectTitle || "未命名项目",
          count: 1,
          note,
        });
      }
    });
    
    return Array.from(map.values());
  }, [notes, projectsList]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#18181B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>文件夹</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.7}
        >
          <IconPark name="plus" size={16} color="#FFF" />
          <Text style={styles.createBtnText}>新建文件夹</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => {
          const colors = getFolderColor(item.id);
          return (
            <TouchableOpacity
              style={styles.folderCard}
              onPress={() => router.push(`/note/${item.id}`)}
              activeOpacity={0.85}
            >
              <View style={[styles.folderBg, { backgroundColor: colors.start }]}>
                <View style={[styles.folderBgOverlay, { backgroundColor: colors.end }]} />
                
                {/* Paper Stack Effect */}
                <View style={styles.paperStack}>
                  <View style={[styles.paper, styles.paper3]} />
                  <View style={[styles.paper, styles.paper2]} />
                  <View style={[styles.paper, styles.paper1]} />
                </View>

                {/* Folder Bottom */}
                <View style={styles.folderBottom}>
                  <View style={styles.folderInfo}>
                    <Text style={styles.folderName} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.folderCount}>{item.count} 个笔记</Text>
                  </View>
                  <TouchableOpacity style={styles.menuBtn} onPress={() => {}}>
                    <Text style={styles.menuDots}>•••</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={{ marginBottom: 12, opacity: 0.5 }}>
              <IconPark name="folder" size={44} color="#A1A1AA" />
            </View>
            <Text style={styles.empty}>还没有文件夹</Text>
            <Text style={styles.emptyHint}>点击右上角新建文件夹，或导入截图自动创建</Text>
          </View>
        }
      />

      {/* Create Folder Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBg}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setCreateModalVisible(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>新建文件夹</Text>
            <TextInput
              style={styles.modalInput}
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="输入文件夹名称"
              placeholderTextColor="#A1A1AA"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateFolder}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => {
                  setCreateModalVisible(false);
                  setNewFolderName("");
                }}
              >
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm, !newFolderName.trim() && styles.modalBtnDisabled]}
                onPress={handleCreateFolder}
                disabled={creating || !newFolderName.trim()}
              >
                <Text style={styles.modalBtnConfirmText}>
                  {creating ? "创建中..." : "创建"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: "700", color: "#18181B" },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181B",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
  },
  createBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
  },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  row: { justifyContent: "space-between" },

  folderCard: {
    width: "48%",
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  folderBg: {
    height: 160,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    position: "relative",
    overflow: "hidden",
  },
  folderBgOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },

  /* Paper Stack */
  paperStack: {
    position: "absolute",
    top: 12,
    left: "50%",
    marginLeft: -40,
    width: 80,
    height: 70,
  },
  paper: {
    position: "absolute",
    width: 56,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  paper1: {
    top: 0,
    left: 12,
    transform: [{ rotate: "-5deg" }],
    zIndex: 3,
  },
  paper2: {
    top: 4,
    left: 18,
    transform: [{ rotate: "2deg" }],
    zIndex: 2,
    opacity: 0.85,
  },
  paper3: {
    top: 8,
    left: 24,
    transform: [{ rotate: "8deg" }],
    zIndex: 1,
    opacity: 0.7,
  },

  /* Folder Bottom */
  folderBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: 14,
  },
  folderInfo: { flex: 1 },
  folderName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 2,
  },
  folderCount: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
  },
  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuDots: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -1,
  },

  emptyContainer: { alignItems: "center", marginTop: 80 },
  empty: { fontSize: 16, fontWeight: "500", color: "#71717A" },
  emptyHint: { fontSize: 13, color: "#A1A1AA", marginTop: 6, textAlign: "center", paddingHorizontal: 40 },

  /* Create Folder Modal */
  modalBg: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalCard: {
    width: "85%",
    maxWidth: 360,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#18181B",
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E4E4E7",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#18181B",
    backgroundColor: "#FAFAFA",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    minWidth: 72,
    alignItems: "center",
  },
  modalBtnCancel: {
    backgroundColor: "#F4F4F5",
  },
  modalBtnCancelText: {
    color: "#52525B",
    fontSize: 14,
    fontWeight: "600",
  },
  modalBtnConfirm: {
    backgroundColor: "#18181B",
  },
  modalBtnConfirmText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  modalBtnDisabled: {
    opacity: 0.4,
  },
});
