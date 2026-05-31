import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import { pickImages } from "../../services/imageUtils";
import ImageCard from "../../components/ImageCard";
import IconPark from "../../components/IconPark";
import { API_BASE_URL, POLL_INTERVAL_MS } from "../../constants/config";

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

  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    loadImages().then((data) => {
      setLoading(false);
      // Start polling if any images are processing
      if (data && data.some((img) => img.status === "processing")) {
        pollingRef.current = setInterval(async () => {
          const updated = await loadImages();
          if (updated && updated.every((img) => img.status !== "processing")) {
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        }, POLL_INTERVAL_MS);
      }
    });
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadImages]);

  const handleImport = async () => {
    try {
      const uris = await pickImages();
      if (uris.length === 0) return;
      setUploading(true);
      await api.uploadImages(projectId, uris);
      await loadImages();
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
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <IconPark name="arrowLeft" size={16} color="#18181B" />
          <Text style={styles.backText}>返回</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          项目 #{projectId} · {images.length} 张图片
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
        data={images}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ImageCard
            image={item}
            baseUrl={API_BASE_URL}
            onUpdate={handleUpdateImage}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.empty}>暂无图片</Text>
            <Text style={styles.emptyHint}>点击上方按钮从相册导入截图</Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
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
  backBtn: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 4 },
  backText: { fontSize: 15, color: "#18181B", fontWeight: "600" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 15, color: "#A1A1AA", fontWeight: "500" },
  importBtn: {
    backgroundColor: "#18181B",
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  importBtnText: { color: "#FFF", fontWeight: "600", fontSize: 14 },
  disabled: { opacity: 0.5 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyContainer: { alignItems: "center", marginTop: 80 },
  empty: { fontSize: 16, fontWeight: "500", color: "#71717A" },
  emptyHint: { fontSize: 13, color: "#A1A1AA", marginTop: 6 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
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
});
