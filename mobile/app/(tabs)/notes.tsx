import { useCallback, useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
  RefreshControl,
  Alert,
  Easing,
  Image,
  Keyboard,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../services/api";
import IconPark from "../../components/IconPark";

const ANDROID_STATUSBAR = Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0;

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

const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });

const FOLDER_COLORS = [
  { bg: "rgba(255,107,107,0.85)", shine: "rgba(255,255,255,0.12)" },
  { bg: "rgba(78,205,196,0.85)", shine: "rgba(255,255,255,0.12)" },
  { bg: "rgba(69,105,144,0.85)", shine: "rgba(255,255,255,0.12)" },
  { bg: "rgba(126,87,194,0.85)", shine: "rgba(255,255,255,0.12)" },
  { bg: "rgba(255,166,43,0.85)", shine: "rgba(255,255,255,0.12)" },
  { bg: "rgba(72,187,120,0.85)", shine: "rgba(255,255,255,0.12)" },
  { bg: "rgba(237,100,166,0.85)", shine: "rgba(255,255,255,0.12)" },
  { bg: "rgba(160,120,120,0.85)", shine: "rgba(255,255,255,0.12)" },
];

function getFolderColor(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i);
    hash |= 0;
  }
  return FOLDER_COLORS[Math.abs(hash) % FOLDER_COLORS.length];
}

function FolderIcon({ title }: { title: string }) {
  return (
    <View style={styles.folderArt}>
      <Image source={require("../../assets/folder.png")} style={styles.folderImage} resizeMode="contain" />
    </View>
  );
}

export default function NotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [projectsList, setProjectsList] = useState<{ id: number; title: string; isDefault: number; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<number | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const sheetAnim = useState(new Animated.Value(400))[0];
  const renameSheetAnim = useState(new Animated.Value(400))[0];

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const loadNotes = useCallback(async () => {
    try {
      const notesData = await api.listAllNotes();
      setNotes(notesData);
    } catch (e) {
      console.error("load notes error:", e);
    }
    try {
      const [projectsData, defaultProject] = await Promise.all([
        api.listProjects(),
        api.getDefaultProject().catch(() => null),
      ]);
      if (defaultProject && !projectsData.some((p) => p.id === defaultProject.id)) {
        projectsData.unshift(defaultProject);
      }
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotes();
    setRefreshing(false);
  }, [loadNotes]);

  const openCreateSheet = () => {
    setNewFolderName("");
    sheetAnim.setValue(400);
    setCreateModalVisible(true);
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 280,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  };

  const closeCreateSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: 400,
      duration: 250,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start(() => setCreateModalVisible(false));
  };

  const handleCreateFolder = async () => {
    const title = newFolderName.trim();
    if (!title) return;
    setCreating(true);
    try {
      const project = await api.createProject(title);
      setProjectsList((prev) => [{ id: project.id, title: project.title, isDefault: project.isDefault, createdAt: project.createdAt }, ...prev]);
      closeCreateSheet();
    } catch (e: any) {
      console.error(e);
      Alert.alert("创建失败", e.message || "请重试");
    } finally {
      setCreating(false);
    }
  };

  const handleLongPress = (item: { id: number; title: string; isDefault: number }) => {
    if (item.isDefault) {
      Alert.alert("默认文件夹", "这是默认文件夹，无法修改或删除");
      return;
    }
    Alert.alert(item.title, undefined, [
      {
        text: "重命名",
        onPress: () => openRenameSheet(item.id, item.title),
      },
      {
        text: "删除",
        style: "destructive",
        onPress: () => confirmDeleteFolder(item.id),
      },
      { text: "取消", style: "cancel" },
    ]);
  };

  const confirmDeleteFolder = (id: number) => {
    Alert.alert("确认删除", "删除文件夹后，其中的笔记不会丢失，仍可在全部笔记中查看。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteProject(id);
            setProjectsList((prev) => prev.filter((p) => p.id !== id));
          } catch (e: any) {
            Alert.alert("删除失败", e.message || "请重试");
          }
        },
      },
    ]);
  };

  const openRenameSheet = (id: number, title: string) => {
    setRenameFolderId(id);
    setRenameFolderName(title);
    setRenameModalVisible(true);
    setTimeout(() => {
      renameSheetAnim.setValue(400);
      Animated.timing(renameSheetAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }).start();
    }, 100);
  };

  const closeRenameSheet = () => {
    Animated.timing(renameSheetAnim, {
      toValue: 400,
      duration: 250,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start(() => setRenameModalVisible(false));
  };

  const handleConfirmRename = async () => {
    if (!renameFolderId || !renameFolderName.trim()) return;
    setRenaming(true);
    try {
      const updated = await api.renameProject(renameFolderId, renameFolderName.trim());
      setProjectsList((prev) => prev.map((p) => (p.id === renameFolderId ? { ...p, title: updated.title } : p)));
      closeRenameSheet();
    } catch (e: any) {
      Alert.alert("重命名失败", e.message || "请重试");
    } finally {
      setRenaming(false);
    }
  };

  const projects = useMemo(() => {
    const map = new Map<number, { id: number; title: string; isDefault: number; count: number }>();
    projectsList.forEach((project) => {
      map.set(project.id, { id: project.id, title: project.title || "未命名项目", isDefault: project.isDefault, count: 0 });
    });
    notes.forEach((note) => {
      const existing = map.get(note.projectId);
      if (existing) {
        existing.count++;
      } else {
        map.set(note.projectId, { id: note.projectId, title: note.projectTitle || "未命名项目", isDefault: 0, count: 1 });
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
      <View style={[styles.header, { paddingTop: insets.top + ANDROID_STATUSBAR + 8 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>文件夹</Text>
          <Text style={styles.count}>{projects.length} 个</Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={openCreateSheet}
          activeOpacity={0.7}
        >
          <IconPark name="plus" size={18} color="#3F3F46" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#18181B" />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.folderCard}
            onPress={() => router.push(`/note-list/${item.id}`)}
            onLongPress={() => handleLongPress(item)}
            delayLongPress={400}
            activeOpacity={0.85}
          >
            <FolderIcon title={item.title} />
            <View style={styles.folderBottom}>
              <Text style={styles.folderName} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.folderCount}>{item.count} 个笔记</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={{ marginBottom: 14, opacity: 0.35 }}>
              <IconPark name="folder" size={44} color="#A1A1AA" />
            </View>
            <Text style={styles.empty}>还没有文件夹</Text>
            <Text style={styles.emptyHint}>点击右上角新建文件夹，或导入截图自动创建</Text>
          </View>
        }
      />

      {/* Create Folder Bottom Sheet */}
      <Modal visible={createModalVisible} transparent animationType="none" onRequestClose={closeCreateSheet}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeCreateSheet} />
          <View style={styles.sheetKAV} pointerEvents="box-none">
            <Animated.View style={[styles.sheetCard, { paddingBottom: insets.bottom + 20, marginBottom: keyboardHeight, transform: [{ translateY: sheetAnim }] }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>新建项目</Text>
              <View style={styles.sheetBody}>
                <TextInput
                  style={styles.sheetInput}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  placeholder="输入项目名称"
                  placeholderTextColor="#D4D4D8"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreateFolder}
                />
                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.sheetCancelBtn} onPress={closeCreateSheet}>
                    <Text style={styles.sheetCancelText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetConfirmBtn, !newFolderName.trim() && { opacity: 0.4 }]}
                    onPress={handleCreateFolder}
                    disabled={creating || !newFolderName.trim()}
                  >
                    <Text style={styles.sheetConfirmText}>{creating ? "创建中..." : "创建"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </View>
        </View>
      </Modal>

      {/* Rename Folder Bottom Sheet */}
      <Modal visible={renameModalVisible} transparent animationType="none" onRequestClose={closeRenameSheet}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeRenameSheet} />
          <View style={styles.sheetKAV} pointerEvents="box-none">
            <Animated.View style={[styles.sheetCard, { paddingBottom: insets.bottom + 20, marginBottom: keyboardHeight, transform: [{ translateY: renameSheetAnim }] }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>重命名项目</Text>
              <View style={styles.sheetBody}>
                <TextInput
                  style={styles.sheetInput}
                  value={renameFolderName}
                  onChangeText={setRenameFolderName}
                  placeholder="输入新的项目名称"
                  placeholderTextColor="#D4D4D8"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleConfirmRename}
                />
                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.sheetCancelBtn} onPress={closeRenameSheet}>
                    <Text style={styles.sheetCancelText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetConfirmBtn, !renameFolderName.trim() && { opacity: 0.4 }]}
                    onPress={handleConfirmRename}
                    disabled={renaming || !renameFolderName.trim()}
                  >
                    <Text style={styles.sheetConfirmText}>{renaming ? "保存中..." : "保存"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </View>
        </View>
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
    paddingBottom: 26,
  },
  headerLeft: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  title: {
    fontFamily: SERIF_FONT,
    fontSize: 26,
    fontWeight: "700",
    color: "#18181B",
    letterSpacing: 0.3,
  },
  count: { fontSize: 13, color: "#A1A1AA", fontWeight: "500" },
  createBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#D4D4D8",
    borderRadius: 100,
    width: 36,
    height: 36,
  },

  list: { paddingHorizontal: 20, paddingBottom: 100 },
  row: { justifyContent: "space-between" },

  folderCard: {
    width: "48%",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  folderArt: {
    width: "100%",
    aspectRatio: 120 / 90,
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  folderImage: {
    width: "100%",
    height: "100%",
  },

  folderBottom: {
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  folderName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  folderCount: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(0,0,0,0.45)",
  },

  emptyContainer: { alignItems: "center", paddingTop: 72, paddingHorizontal: 40 },
  empty: { fontSize: 16, fontWeight: "500", color: "#71717A" },
  emptyHint: { fontSize: 13, color: "#A1A1AA", marginTop: 6, textAlign: "center", lineHeight: 20 },

  /* Bottom Sheet */
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheetKAV: { width: "100%" },
  sheetCard: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 34,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D4D4D8",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 0,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#18181B",
    paddingTop: 18,
    paddingBottom: 14,
  },
  sheetBody: { gap: 14 },
  sheetInput: {
    borderWidth: 1.5,
    borderColor: "#ECECEE",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#18181B",
    backgroundColor: "#FAFAFA",
  },
  sheetActions: { flexDirection: "row", gap: 10 },
  sheetCancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#ECECEE",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  sheetCancelText: { fontSize: 15, fontWeight: "600", color: "#52525B" },
  sheetConfirmBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#18181B",
  },
  sheetConfirmText: { fontSize: 15, fontWeight: "600", color: "#FFF" },
});
