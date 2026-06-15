import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Platform,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type NoteListItem } from "../../services/api";
import IconPark from "../../components/IconPark";
import { API_BASE_URL } from "../../constants/config";

const ANDROID_STATUSBAR = Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0;

const TAG_PALETTE = [
  { bg: "#FDECD6", text: "#C57C00" },
  { bg: "#D6EAFF", text: "#1A73E8" },
  { bg: "#E4D6F5", text: "#7C4DFF" },
  { bg: "#F5EED6", text: "#8B6914" },
  { bg: "#D6F5E8", text: "#0A7A3E" },
  { bg: "#F5D6D6", text: "#D32F2F" },
  { bg: "#E4E4E7", text: "#52525B" },
  { bg: "#FFF3CD", text: "#856404" },
];

function getTagColors(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash) + tag.charCodeAt(i);
    hash |= 0;
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

function resolveImageUri(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("http")) return uri;
  if (uri.startsWith("/")) return `${API_BASE_URL}${uri}`;
  return `file:///${uri.replace(/\\/g, "/")}`;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("zh-CN");
  } catch {
    return "";
  }
}

function StackImagePreview({ urls }: { urls: string[] }) {
  const imgs = urls.slice(0, 3);
  const rotations: { [k: number]: string } = { 0: "-6deg", 1: "0deg", 2: "6deg" };
  const tops: { [k: number]: number } = { 0: 4, 1: 0, 2: 4 };
  const lefts: { [k: number]: number } = { 0: 0, 1: 8, 2: 16 };

  if (imgs.length === 0) {
    return (
      <View style={styles.pncStack}>
        <View style={[styles.pncPlaceholder, { transform: [{ rotate: "-6deg" }], top: 4, left: 0, zIndex: 1 }]}>
          <IconPark name="document" size={24} color="#D4D4D8" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.pncStack}>
      {imgs.map((url, j) => (
        <Image
          key={j}
          source={{ uri: resolveImageUri(url) }}
          style={[
            styles.pncImg,
            {
              transform: [{ rotate: rotations[j] }],
              top: tops[j],
              left: lefts[j],
              zIndex: j + 1,
            },
          ]}
          resizeMode="cover"
        />
      ))}
    </View>
  );
}

function NoteCard({ note, onPress }: { note: NoteListItem; onPress: () => void }) {
  let tagList: string[] = [];
  try {
    tagList = JSON.parse(note.tags || "[]");
    if (!Array.isArray(tagList)) tagList = [];
  } catch {
    tagList = [];
  }
  const displayTags = tagList.slice(0, 3);
  const moreCount = tagList.length - 3;
  const excerpt = (note.content || "").substring(0, 120) || "暂无内容";

  return (
    <TouchableOpacity style={styles.pnc} onPress={onPress} activeOpacity={0.85}>
      <StackImagePreview urls={note.imageUrls || []} />
      <View style={styles.pncTxt}>
        <Text style={styles.pncTitle} numberOfLines={1}>
          {note.title || note.projectTitle || "无标题"}
        </Text>
        <Text style={styles.pncExcerpt} numberOfLines={2}>
          {excerpt}
        </Text>
        <View style={styles.pncMeta}>
          <View style={styles.pncMetaItem}>
            <IconPark name="camera" size={12} color="#A1A1AA" />
            <Text style={styles.pncMetaText}>{note.imageCount} 张截图</Text>
          </View>
          <Text style={styles.pncMetaDot}>·</Text>
          <Text style={styles.pncMetaText}>{formatDate(note.updatedAt)}</Text>
        </View>
        {displayTags.length > 0 && (
          <View style={styles.pncTags}>
            {displayTags.map((tag, i) => {
              const c = getTagColors(tag);
              return (
                <View key={`${tag}-${i}`} style={[styles.pncTag, { backgroundColor: c.bg }]}>
                  <Text style={[styles.pncTagText, { color: c.text }]}>{tag}</Text>
                </View>
              );
            })}
            {moreCount > 0 && <Text style={styles.pncTagMore}>+{moreCount}</Text>}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function NoteListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = parseInt(id, 10);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [projectTitle, setProjectTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => {
      try {
        JSON.parse(n.tags || "[]").forEach((t) => tagSet.add(t));
      } catch {}
    });
    return Array.from(tagSet).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    if (selectedTags.length === 0) return notes;
    return notes.filter((n) => {
      try {
        const noteTags: string[] = JSON.parse(n.tags || "[]");
        return selectedTags.some((t) => noteTags.includes(t));
      } catch {
        return false;
      }
    });
  }, [notes, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const loadAll = useCallback(async () => {
    try {
      const [notesData, projects] = await Promise.all([
        api.listAllNotes().catch(() => []),
        api.listProjects().catch(() => []),
      ]);
      const filtered = notesData.filter((n) => n.projectId === projectId);
      setNotes(filtered);
      const proj = projects.find((p) => p.id === projectId);
      if (proj) setProjectTitle(proj.title);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

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
          <Text style={styles.backText} numberOfLines={1}>{projectTitle}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredNotes}
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
                  style={[styles.tagChip, selectedTags.length === 0 && styles.tagChipActive]}
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
                    style={[styles.tagChip, selectedTags.includes(tag) && styles.tagChipActive]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text
                      style={[styles.tagChipText, selectedTags.includes(tag) && styles.tagChipTextActive]}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <NoteCard
            note={item}
            onPress={() =>
              router.push({ pathname: "/note/[id]", params: { id: String(item.id) } })
            }
          />
        )}
        ListEmptyComponent={
          notes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={{ marginBottom: 14, opacity: 0.35 }}>
                <IconPark name="document" size={44} color="#A1A1AA" />
              </View>
              <Text style={styles.empty}>还没有笔记</Text>
              <Text style={styles.emptyHint}>导入截图后，笔记会出现在这里</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={{ marginBottom: 14, opacity: 0.35 }}>
                <IconPark name="search" size={44} color="#A1A1AA" />
              </View>
              <Text style={styles.empty}>无匹配结果</Text>
              <Text style={styles.emptyHint}>试试其他标签筛选</Text>
            </View>
          )
        }
      />
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
  backText: { fontSize: 16, color: "#18181B", fontWeight: "600" },
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
  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  tagFilterWrap: { paddingBottom: 12 },
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
  tagChipText: { fontSize: 13, fontWeight: "500", color: "#71717A" },
  tagChipTextActive: { color: "#FFF" },
  pnc: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ECECEE",
    marginBottom: 12,
  },
  pncStack: { width: 64, height: 72, position: "relative", flexShrink: 0 },
  pncImg: {
    position: "absolute",
    width: 52,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#F4F4F5",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pncPlaceholder: {
    position: "absolute",
    width: 52,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#F4F4F5",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  pncTxt: { flex: 1, minWidth: 0, gap: 4 },
  pncTitle: { fontSize: 15, fontWeight: "600", color: "#18181B", lineHeight: 20 },
  pncExcerpt: { fontSize: 13, color: "#52525B", lineHeight: 19 },
  pncMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: "auto" },
  pncMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  pncMetaText: { fontSize: 12, color: "#A1A1AA" },
  pncMetaDot: { fontSize: 12, color: "#A1A1AA" },
  pncTags: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 4 },
  pncTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  pncTagText: { fontSize: 11, fontWeight: "500" },
  pncTagMore: { fontSize: 11, color: "#A1A1AA", fontWeight: "500" },
  emptyContainer: { alignItems: "center", marginTop: 72, paddingHorizontal: 40 },
  empty: { fontSize: 16, fontWeight: "500", color: "#71717A" },
  emptyHint: { fontSize: 13, color: "#A1A1AA", marginTop: 6, textAlign: "center", lineHeight: 20 },
});
