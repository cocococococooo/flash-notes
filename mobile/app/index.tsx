import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Animated,
  Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "../services/api";
import IconPark from "../components/IconPark";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = 240;
const CARD_H = 150;

interface Project {
  id: number;
  title: string;
  createdAt: string;
}

const CAROUSEL_ITEMS = [
  { bg: ["#667eea", "#764ba2"], label: "笔记预览" },
  { bg: ["#f093fb", "#f5576c"], label: "知识整理" },
  { bg: ["#4facfe", "#00f2fe"], label: "AI 总结" },
  { bg: ["#43e97b", "#38f9d7"], label: "标签分类" },
  { bg: ["#fa709a", "#fee140"], label: "快速检索" },
];

function CarouselCard({ item, index, currentIndex }: { item: typeof CAROUSEL_ITEMS[0]; index: number; currentIndex: number }) {
  const diff = index - currentIndex;
  const absDiff = Math.abs(diff);

  let translateY = 0, scale = 1, rotate = "0deg", opacity = 1, zIndex = 100;
  if (diff === 0) {
    translateY = 0; scale = 1; rotate = "0deg"; opacity = 1; zIndex = 100;
  } else if (absDiff === 1) {
    translateY = diff * 55; scale = 0.82; rotate = `${diff * 8}deg`; opacity = 0.65; zIndex = 99;
  } else if (absDiff === 2) {
    translateY = diff * 55; scale = 0.68; rotate = `${diff * 15}deg`; opacity = 0.45; zIndex = 98;
  } else {
    translateY = diff > 0 ? 170 : -170; scale = 0.55; rotate = `${diff * 20}deg`; opacity = 0; zIndex = 97;
  }

  return (
    <Animated.View
      style={[
        styles.carouselCard,
        {
          transform: [{ translateY }, { scale }, { rotate }],
          opacity,
          zIndex,
        },
      ]}
      pointerEvents={diff === 0 ? "auto" : "none"}
    >
      <View style={[styles.cardGradient, { backgroundColor: item.bg[0] }]}>
        <View style={[styles.cardGradientOverlay, { backgroundColor: item.bg[1] }]} />
        <Text style={styles.cardLabel}>{item.label}</Text>
      </View>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const loadProjects = useCallback(async () => {
    try {
      const data = await api.listProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const project = await api.createProject(title);
      setNewTitle("");
      router.push(`/project/${project.id}`);
    } catch (e: any) {
      Alert.alert("错误", e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (project: Project) => {
    Alert.alert("确认删除", `删除"${project.title}"及其所有数据？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteProject(project.id);
            await loadProjects();
          } catch (e: any) {
            Alert.alert("错误", e.message);
          }
        },
      },
    ]);
  };

  const carouselPrev = () => {
    setCarouselIndex((i) => (i - 1 + CAROUSEL_ITEMS.length) % CAROUSEL_ITEMS.length);
  };

  const carouselNext = () => {
    setCarouselIndex((i) => (i + 1) % CAROUSEL_ITEMS.length);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#18181B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.badge}>AI POWERED</Text>
        <Text style={styles.title}>闪记</Text>
        <Text style={styles.subtitle}>导入截图，AI 自动生成结构化笔记</Text>
      </View>

      {/* 3D Carousel */}
      <View style={styles.carouselSection}>
        <View style={styles.carouselWrap}>
          <TouchableOpacity style={[styles.navBtn, { left: 8 }]} onPress={carouselPrev} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navBtn, { right: 8 }]} onPress={carouselNext} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>›</Text>
          </TouchableOpacity>
          {CAROUSEL_ITEMS.map((item, i) => (
            <CarouselCard key={i} item={item} index={i} currentIndex={carouselIndex} />
          ))}
        </View>
        <Text style={styles.carouselCounter}>{carouselIndex + 1} / {CAROUSEL_ITEMS.length}</Text>
      </View>

      {/* Import Button */}
      <View style={styles.importSection}>
        <TouchableOpacity
          style={styles.importBtnSlim}
          onPress={() => {
            if (projects.length === 0) {
              Alert.alert("提示", "请先创建一个项目");
              return;
            }
            router.push(`/project/${projects[0].id}`);
          }}
          activeOpacity={0.8}
        >
          <IconPark name="camera" size={18} color="#FFF" />
          <Text style={styles.importBtnSlimText}>从相册导入截图</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.createSection}>
        <Text style={styles.sectionTitle}>学习项目</Text>
        <View style={styles.createRow}>
          <TextInput
            style={styles.input}
            placeholder="新建项目，输入标题..."
            placeholderTextColor="#999"
            value={newTitle}
            onChangeText={setNewTitle}
            onSubmitEditing={handleCreate}
          />
          <TouchableOpacity
            style={[styles.createBtn, creating && styles.disabled]}
            onPress={handleCreate}
            disabled={creating}
          >
            <Text style={styles.createBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/project/${item.id}`)}
            onLongPress={() => handleDelete(item)}
          >
            <View style={styles.cardIcon}>
              <IconPark name="folder" size={22} color="#71717A" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDate}>
                {new Date(item.createdAt).toLocaleDateString("zh-CN")}
              </Text>
            </View>
            <IconPark name="arrowRight" size={18} color="#D4D4D8" />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={{ marginBottom: 10, opacity: 0.5 }}>
              <IconPark name="write" size={36} color="#A1A1AA" />
            </View>
            <Text style={styles.empty}>还没有学习项目</Text>
            <Text style={styles.emptyHint}>输入标题创建一个吧</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },
  hero: { paddingTop: 20, paddingHorizontal: 20, marginBottom: 20 },
  badge: {
    fontSize: 10,
    fontWeight: "600",
    color: "#18181B",
    letterSpacing: 4,
    marginBottom: 10,
  },
  title: { fontSize: 34, fontWeight: "700", color: "#18181B" },
  subtitle: { fontSize: 14, color: "#A1A1AA", marginTop: 8, lineHeight: 22 },

  /* Carousel */
  carouselSection: { marginBottom: 20 },
  carouselWrap: {
    width: "100%",
    height: 190,
    alignItems: "center",
    justifyContent: "center",
  },
  carouselCard: {
    position: "absolute",
    width: CARD_W,
    height: CARD_H,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardGradient: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  cardGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },
  cardLabel: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    zIndex: 1,
  },
  navBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -18,
    zIndex: 200,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.73)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  navBtnText: { fontSize: 22, color: "#18181B", fontWeight: "400", marginTop: -2 },
  carouselCounter: {
    textAlign: "center",
    fontSize: 12,
    color: "#A1A1AA",
    fontWeight: "500",
    letterSpacing: 1,
    marginTop: 8,
  },

  /* Import button slim */
  importSection: { paddingHorizontal: 20, marginBottom: 28 },
  importBtnSlim: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#18181B",
    borderRadius: 100,
    paddingVertical: 14,
    width: "100%",
    shadowColor: "#18181B",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  importBtnSlimText: { color: "#FFF", fontWeight: "600", fontSize: 14, letterSpacing: 0.5 },

  createSection: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "600", color: "#A1A1AA", marginBottom: 14, letterSpacing: 2 },
  createRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E4E4E7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "#FFF",
  },
  createBtn: {
    backgroundColor: "#18181B",
    borderRadius: 10,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnText: { color: "#FFF", fontWeight: "600", fontSize: 22, marginTop: -2 },
  disabled: { opacity: 0.5 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ECECEE",
  },
  cardIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#F4F4F5", alignItems: "center", justifyContent: "center", marginRight: 12 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#18181B" },
  cardDate: { fontSize: 12, color: "#A1A1AA", marginTop: 2 },

  emptyContainer: { alignItems: "center", marginTop: 60 },
  empty: { fontSize: 15, fontWeight: "500", color: "#71717A" },
  emptyHint: { fontSize: 13, color: "#A1A1AA", marginTop: 4 },
});
