import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Platform, StatusBar, StyleSheet, ActivityIndicator, Animated, Image, RefreshControl, Alert } from "react-native";
import AnimatedRN, { useSharedValue, useDerivedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../services/api";
import { pickImages } from "../../services/imageUtils";
import IconPark from "../../components/IconPark";
import { POLL_INTERVAL_MS } from "../../constants/config";
import { getRecentNotes, addRecentNote } from "../../services/recentNotes";

const ANDROID_STATUSBAR = Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0;

const CARD_W = 150;
const CARD_H = 150;

const CAROUSEL_ITEMS = [
  { src: require("../../assets/carousel-1.jpg") },
  { src: require("../../assets/carousel-2.jpg") },
  { src: require("../../assets/carousel-3.jpg") },
  { src: require("../../assets/carousel-4.jpg") },
  { src: require("../../assets/carousel-5.jpg") },
];

const POSITIONS = [
  { x: -130, scale: 0.6, opacity: 0.45, zIndex: 2, border: 3, shadowSmall: true },
  { x: -70, scale: 0.8, opacity: 1, zIndex: 3, border: 3, shadowSmall: true },
  { x: 0, scale: 0.95, opacity: 1, zIndex: 5, border: 6, shadowSmall: false },
  { x: 70, scale: 0.8, opacity: 1, zIndex: 3, border: 3, shadowSmall: true },
  { x: 130, scale: 0.6, opacity: 0.45, zIndex: 2, border: 3, shadowSmall: true },
];

const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });

function CarouselCard({ item, index, centerIndex }: { item: typeof CAROUSEL_ITEMS[0]; index: number; centerIndex: number }) {
  const n = CAROUSEL_ITEMS.length;
  const offset = ((index - centerIndex + n) % n) - 2;
  const pos = POSITIONS[offset + 2];
  const isCenter = offset === 0;

  const targetX = useSharedValue(pos.x);
  const targetScale = useSharedValue(pos.scale);
  const targetOpacity = useSharedValue(pos.opacity);
  const targetOverlay = useSharedValue(isCenter ? 0.2 : 0.13);

  targetX.value = pos.x;
  targetScale.value = pos.scale;
  targetOpacity.value = pos.opacity;
  targetOverlay.value = isCenter ? 0.2 : 0.13;

  const easing = Easing.bezier(0.25, 0.1, 0.25, 1);

  const animX = useDerivedValue(() => withTiming(targetX.value, { duration: 900, easing }));
  const animScale = useDerivedValue(() => withTiming(targetScale.value, { duration: 900, easing }));
  const animOpacity = useDerivedValue(() => withTiming(targetOpacity.value, { duration: 900, easing }));
  const animOverlay = useDerivedValue(() => withTiming(targetOverlay.value, { duration: 900, easing }));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: animX.value }, { scale: animScale.value }],
    opacity: animOpacity.value,
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: animOverlay.value,
  }));

  return (
    <AnimatedRN.View
      style={[
        styles.carouselCard,
        animatedStyle,
        {
          zIndex: pos.zIndex,
          borderWidth: pos.border,
          borderColor: isCenter ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.5)",
          shadowColor: "#000",
          shadowOpacity: pos.shadowSmall ? 0.035 : 0.11,
          shadowRadius: pos.shadowSmall ? 18 : 40,
          shadowOffset: { width: 0, height: pos.shadowSmall ? 6 : 28 },
        },
      ]}
    >
      <Image source={item.src} style={styles.cardImage} resizeMode="cover" />
      <AnimatedRN.View style={[styles.cardOverlay, overlayStyle]} />
    </AnimatedRN.View>
  );
}

function formatTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<{ id: number; title: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(2);
  const [recentNotes, setRecentNotes] = useState<{ noteId: number; projectId: number; title: string; timestamp: number; imageCount: number }[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslate = useRef(new Animated.Value(12)).current;

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

  const loadRecentNotes = useCallback(async () => {
    const recent = await getRecentNotes();
    setRecentNotes(recent);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProjects(), loadRecentNotes()]);
    setRefreshing(false);
  }, [loadProjects, loadRecentNotes]);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
      loadRecentNotes();
      heroOpacity.setValue(0);
      heroTranslate.setValue(12);
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(heroTranslate, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start();
    }, [loadProjects, loadRecentNotes, heroOpacity, heroTranslate])
  );

  useEffect(() => {
    carouselTimer.current = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % CAROUSEL_ITEMS.length);
    }, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (carouselTimer.current) clearInterval(carouselTimer.current);
    };
  }, []);

  const startPolling = useCallback((projectId: number) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const data = await api.listImages(projectId);
        if (data.every((img) => img.status !== "processing")) {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (e) {
        console.error(e);
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const handleQuickImport = async () => {
    try {
      setImporting(true);
      const defaultProj = await api.getDefaultProject();
      const targetProjectId = defaultProj.id;
      const uris = await pickImages();
      if (uris.length === 0) {
        setImporting(false);
        return;
      }
      const noteData = await api.getNote(targetProjectId).catch(() => null);
      let noteId: number;
      let noteTitle: string;
      if (noteData) {
        noteId = noteData.id;
        noteTitle = noteData.title || "默认笔记";
      } else {
        const created = await api.createNote(targetProjectId, "默认笔记", "", "[]");
        noteId = created.id;
        noteTitle = created.title || "默认笔记";
      }
      await api.uploadImages(targetProjectId, uris, noteId);
      addRecentNote(noteId, targetProjectId, noteTitle, uris.length);
      startPolling(targetProjectId, noteId);
      router.push({ pathname: "/note/[id]", params: { id: String(noteId), fromRecent: "true" } });
    } catch (e: any) {
      Alert.alert("导入失败", e.message || "未知错误");
    } finally {
      setImporting(false);
    }
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
      <FlatList
        data={recentNotes}
        keyExtractor={(item) => String(item.noteId)}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#18181B" />
        }
        ListHeaderComponent={
          <View>
            <Animated.View style={[styles.hero, { marginTop: insets.top + ANDROID_STATUSBAR + 12, opacity: heroOpacity, transform: [{ translateY: heroTranslate }] }]}>
              <Text style={styles.title}>闪记</Text>
              <Text style={styles.subtitle}>导入截图，自动识别提取文本</Text>
            </Animated.View>

            <View style={styles.carouselSection}>
              <View style={styles.carouselWrap}>
                {CAROUSEL_ITEMS.map((item, i) => (
                  <CarouselCard key={i} item={item} index={i} centerIndex={carouselIndex} />
                ))}
              </View>
            </View>

            <View style={styles.importSection}>
              <TouchableOpacity
                style={[styles.importBtnSlim, importing && styles.disabled]}
                onPress={handleQuickImport}
                disabled={importing}
                activeOpacity={0.8}
              >
                <IconPark name="camera" size={18} color="#FFF" />
                <Text style={styles.importBtnSlimText}>
                  {importing ? "导入中..." : "从相册导入截图"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>最近访问</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.projectCard, index === recentNotes.length - 1 && { marginBottom: 0 }]}
            onPress={() => {
              addRecentNote(item.noteId, item.projectId, item.title, item.imageCount);
              router.push({ pathname: "/note/[id]", params: { id: String(item.noteId), fromRecent: "true" } });
            }}
            activeOpacity={0.85}
          >
            <View style={styles.projectCardIcon}>
              <IconPark name="image" size={18} color="#52525B" />
            </View>
            <View style={styles.projectCardBody}>
              <Text style={styles.projectCardTitle} numberOfLines={1}>{item.title || "笔记"}</Text>
              <Text style={styles.projectCardDesc} numberOfLines={1}>
                {`${item.imageCount} 张图片 · ${formatTime(item.timestamp)}`}
              </Text>
            </View>
            <View style={styles.projectCardArrow}>
              <IconPark name="arrowRight" size={16} color="#D4D4D8" />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyProjects}>
            <Text style={styles.emptyProjectsTitle}>暂无最近访问</Text>
            <Text style={styles.emptyProjectsHint}>打开笔记后会显示在这里</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: insets.bottom + 100 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },
  scroll: { paddingBottom: 20 },
  hero: { paddingHorizontal: 20, paddingTop: 12, marginBottom: 28 },
  title: {
    fontFamily: SERIF_FONT,
    fontSize: 34,
    fontWeight: "700",
    color: "#18181B",
    letterSpacing: 0.5,
  },
  subtitle: { fontSize: 14, color: "#A1A1AA", marginTop: 8, lineHeight: 22 },

  /* Carousel */
  carouselSection: { width: "100%", height: 240, marginBottom: 8 },
  carouselWrap: {
    width: "100%",
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  carouselCard: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -CARD_W / 2,
    marginTop: -CARD_H / 2,
    width: CARD_W,
    height: CARD_H,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#F4F4F5",
    borderWidth: 6,
    borderColor: "#FFF",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 28 },
    shadowOpacity: 0.11,
    shadowRadius: 40,
  },
  cardImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },

  /* Import button */
  importSection: { paddingHorizontal: 20, marginBottom: 32 },
  importBtnSlim: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18181B",
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: "100%",
    shadowColor: "#18181B",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  importBtnSlimText: { color: "#FFF", fontWeight: "600", fontSize: 14, letterSpacing: 0.5, marginLeft: 8 },

  /* Section label */
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#A1A1AA",
    paddingHorizontal: 20,
    marginBottom: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  /* Recent project card */
  projectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ECECEE",
    gap: 14,
  },
  projectCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
  },
  projectCardBody: { flex: 1, minWidth: 0 },
  projectCardTitle: { fontSize: 15, fontWeight: "600", color: "#18181B" },
  projectCardDesc: { fontSize: 12, color: "#A1A1AA", marginTop: 3 },
  projectCardArrow: {},

  /* Empty */
  emptyProjects: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 20 },
  emptyProjectsTitle: { fontSize: 15, fontWeight: "500", color: "#A1A1AA" },
  emptyProjectsHint: { fontSize: 13, color: "#D4D4D8", marginTop: 4 },

  disabled: { opacity: 0.5 },
});
