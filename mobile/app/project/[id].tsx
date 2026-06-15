import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../services/api";
import { pickImages } from "../../services/imageUtils";
import ImageCard from "../../components/ImageCard";
import IconPark from "../../components/IconPark";
import { API_BASE_URL, POLL_INTERVAL_MS } from "../../constants/config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ANDROID_STATUSBAR = Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0;

interface ImageData {
  id: number;
  localUri: string;
  ocrText: string;
  aiSummary: string;
  userSummary: string;
  tags: string;
  status: string;
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = parseInt(id, 10);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [images, setImages] = useState<ImageData[]>([]);
  const [projectTitle, setProjectTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    images.forEach((img) => {
      try {
        JSON.parse(img.tags || "[]").forEach((t: string) => tagSet.add(t));
      } catch {}
    });
    return Array.from(tagSet).sort();
  }, [images]);

  const filteredImages = useMemo(() => {
    if (selectedTags.length === 0) return images;
    return images.filter((img) => {
      try {
        const imgTags: string[] = JSON.parse(img.tags || "[]");
        return selectedTags.some((t) => imgTags.includes(t));
      } catch {
        return false;
      }
    });
  }, [images, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const loadImages = useCallback(async () => {
    try {
      const data = await api.listImages(projectId);
      setImages(data);
      return data;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [projectId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadImages(), loadProjectTitle()]);
    setRefreshing(false);
  }, [loadImages, loadProjectTitle]);

  const loadProjectTitle = useCallback(async () => {
    try {
      const projects = await api.listProjects();
      const project = projects.find(p => p.id === projectId);
      if (project) {
        setProjectTitle(project.title);
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      const updated = await loadImages();
      if (updated && updated.every((img) => img.status !== "processing")) {
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    }, POLL_INTERVAL_MS);
  }, [loadImages]);

  useEffect(() => {
    loadProjectTitle();
    loadImages().then((data) => {
      setLoading(false);
      if (data && data.some((img) => img.status === "processing")) {
        startPolling();
      }
    });
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadImages, loadProjectTitle, startPolling]);

  const handleImport = async () => {
    try {
      const uris = await pickImages();
      if (uris.length === 0) return;
      setUploading(true);
      await api.uploadImages(projectId, uris);
      const data = await loadImages();
      if (data && data.some((img) => img.status === "processing")) {
        startPolling();
      }
    } catch (e: any) {
      Alert.alert("导入失败", e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateImage = async (
    imageId: number,
    data: { userSummary?: string; tags?: string }
  ) => {
    try {
      await api.updateImage(imageId, data);
      await loadImages();
    } catch (e: any) {
      Alert.alert("更新失败", e.message);
    }
  };

  const handleRetryImage = async (imageId: number) => {
    try {
      await api.reanalyzeImage(imageId);
      await loadImages();
    } catch (e: any) {
      Alert.alert("重新识别失败", e.message);
    }
  };

  const handleGenerateNote = async () => {
    setGenerating(true);
    try {
      await api.generateNote(projectId);
      router.push(`/note/${projectId}`);
    } catch (e: any) {
      Alert.alert("生成失败", e.message);
    } finally {
      setGenerating(false);
    }
  };

  const allDone = images.length > 0 && images.every((img) => img.status === "done");
  const hasProcessing = images.some((img) => img.status !== "done");

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#18181B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconPark name="arrowLeft" size={16} color="#18181B" />
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {projectTitle} · {images.length} 张图片
        </Text>
        <TouchableOpacity
          style={[styles.importBtn, uploading && styles.disabled]}
          onPress={handleImport}
          disabled={uploading}
        >
          <Text style={styles.importBtnText}>
            {uploading ? "上传中..." : "从相册导入"}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredImages}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#18181B" />
        }
        ListHeaderComponent={
          allTags.length > 0 ? (
            <View style={styles.tagFilterWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagFilterContent}
              >
                <TouchableOpacity
                  style={[
                    styles.tagChip,
                    selectedTags.length === 0 && styles.tagChipActive,
                  ]}
                  onPress={() => setSelectedTags([])}
                >
                  <Text
                    style={[
                      styles.tagChipText,
                      selectedTags.length === 0 && styles.tagChipTextActive,
                    ]}
                  >
                    全部
                  </Text>
                </TouchableOpacity>
                {allTags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tagChip,
                      selectedTags.includes(tag) && styles.tagChipActive,
                    ]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text
                      style={[
                        styles.tagChipText,
                        selectedTags.includes(tag) && styles.tagChipTextActive,
                      ]}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <ImageCard
            image={item}
            baseUrl={API_BASE_URL}
            onUpdate={handleUpdateImage}
            onRetry={handleRetryImage}
            onPressImage={() => setPreviewIndex(index)}
          />
        )}
        ListEmptyComponent={
          images.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.empty}>暂无图片</Text>
              <Text style={styles.emptyHint}>点击上方按钮从相册导入截图</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.empty}>无匹配结果</Text>
              <Text style={styles.emptyHint}>试试其他标签筛选</Text>
            </View>
          )
        }
      />

      {/* Image Preview Gallery */}
      <Modal visible={previewIndex !== null} transparent animationType="fade" onRequestClose={() => setPreviewIndex(null)}>
        <View style={styles.modalBg}>
          <TouchableOpacity
            style={[styles.modalClose, { top: insets.top + 16 }]}
            onPress={() => setPreviewIndex(null)}
            activeOpacity={0.7}
          >
            <IconPark name="close" size={22} color="#FFF" />
          </TouchableOpacity>
          {previewIndex !== null && (
            <View style={[styles.modalCounter, { top: insets.top + 24 }]}>
              <Text style={styles.modalCounterText}>{previewIndex + 1} / {images.length}</Text>
            </View>
          )}
          {previewIndex !== null && (
            <FlatList
              data={images}
              keyExtractor={(item) => String(item.id)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={previewIndex}
              getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                if (idx !== previewIndex && idx >= 0 && idx < images.length) setPreviewIndex(idx);
              }}
              style={styles.previewList}
              contentContainerStyle={styles.previewListContent}
              renderItem={({ item }) => {
                const uri = item.localUri.startsWith("http")
                  ? item.localUri
                  : item.localUri.startsWith("/")
                  ? `${API_BASE_URL}${item.localUri}`
                  : `file:///${item.localUri.replace(/\\/g, "/")}`;
                return (
                  <View style={styles.previewItem}>
                    <Image source={{ uri }} style={styles.previewImage} resizeMode="contain" />
                  </View>
                );
              }}
            />
          )}
        </View>
      </Modal>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[
            styles.generateBtn,
            (!allDone || generating) && styles.disabled,
          ]}
          onPress={handleGenerateNote}
          disabled={!allDone || generating}
        >
          <Text style={styles.generateBtnText}>
            {generating
              ? "生成中..."
              : hasProcessing
              ? "等待分析完成..."
              : images.length === 0
              ? "请先导入图片"
              : "生成项目总结"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#ECECEE",
    flexShrink: 0,
    gap: 12,
    position: "relative",
  },
  backBtn: { paddingVertical: 8, zIndex: 10, flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 14, color: "#18181B", fontWeight: "500" },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#18181B",
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    pointerEvents: "none",
  },
  importBtn: {
    backgroundColor: "#18181B",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 1,
  },
  importBtnText: { color: "#FFF", fontWeight: "600", fontSize: 13 },
  disabled: { opacity: 0.5 },
  tagFilterWrap: { paddingTop: 12, paddingBottom: 8 },
  tagFilterContent: { gap: 8 },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: "#D4D4D8",
    backgroundColor: "#FFF",
  },
  tagChipActive: {
    backgroundColor: "#18181B",
    borderColor: "#18181B",
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#71717A",
  },
  tagChipTextActive: {
    color: "#FFF",
  },
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  emptyContainer: { alignItems: "center", marginTop: 80 },
  empty: { fontSize: 16, fontWeight: "500", color: "#71717A" },
  emptyHint: { fontSize: 13, color: "#A1A1AA", marginTop: 6 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#FAFAFA",
    borderTopWidth: 1,
    borderTopColor: "#F0F0EE",
  },
  generateBtn: {
    backgroundColor: "#18181B",
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: "center",
  },
  generateBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },

  /* Image Preview Gallery */
  modalBg: { flex: 1, backgroundColor: "rgba(24,24,27,0.92)", justifyContent: "center", alignItems: "center" },
  modalClose: { position: "absolute", right: 20, zIndex: 10, paddingVertical: 8, paddingHorizontal: 22, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  modalCounter: { position: "absolute", left: 0, right: 0, zIndex: 10, alignItems: "center" },
  modalCounterText: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "500", backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, overflow: "hidden" },
  previewList: { flex: 1, width: "100%" },
  previewListContent: { alignItems: "center" },
  previewItem: { width: SCREEN_WIDTH, flex: 1, justifyContent: "center", alignItems: "center" },
  previewImage: { width: "90%", height: "80%", borderRadius: 8 },
});
