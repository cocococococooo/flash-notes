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
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "../services/api";
import { API_BASE_URL } from "../constants/config";
import IconPark from "../components/IconPark";

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

function stripMarkdown(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, "[图片]")
    .replace(/[#*`\[\]]/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

export default function NotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      const data = await api.listAllNotes();
      setNotes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((note) => {
      try {
        const tags = JSON.parse(note.tags || "[]");
        tags.forEach((tag: string) => tagSet.add(tag));
      } catch {}
    });
    return Array.from(tagSet);
  }, [notes]);

  const filteredNotes = useMemo(() => {
    if (!selectedTag) return notes;
    return notes.filter((note) => {
      try {
        const tags = JSON.parse(note.tags || "[]");
        return tags.includes(selectedTag);
      } catch {
        return false;
      }
    });
  }, [notes, selectedTag]);

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
        <Text style={styles.title}>全部笔记</Text>
        <Text style={styles.count}>{filteredNotes.length} 篇</Text>
      </View>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <View style={styles.filterContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <TouchableOpacity
              style={[styles.filterTag, !selectedTag && styles.filterTagActive]}
              onPress={() => setSelectedTag(null)}
            >
              <Text style={[styles.filterTagText, !selectedTag && styles.filterTagTextActive]}>
                全部
              </Text>
            </TouchableOpacity>
            {allTags.map((tag, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.filterTag, selectedTag === tag && styles.filterTagActive]}
                onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                <Text style={[styles.filterTagText, selectedTag === tag && styles.filterTagTextActive]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filteredNotes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          let tagList: string[] = [];
          try { tagList = JSON.parse(item.tags); } catch {}
          const displayImages = (item.imageUrls || []).slice(0, 3);

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/note/${item.projectId}`)}
              activeOpacity={0.7}
            >
              {/* Stacked Images Area */}
              <View style={styles.imageStackContainer}>
                {displayImages.length === 0 ? (
                  <View style={[styles.stackImage, styles.stackPlaceholder, { transform: [{ rotate: "-6deg" }] }]}>
                    <IconPark name="notes" size={28} color="#D4D4D8" />
                  </View>
                ) : (
                  displayImages.map((url, i) => {
                    const rotations = ["-8deg", "0deg", "6deg"];
                    const offsets = [
                      { top: 4, left: 0 },
                      { top: 0, left: 10 },
                      { top: 2, left: 20 },
                    ];
                    const transformStyle = {
                      transform: [{ rotate: rotations[i] || "0deg" }],
                      top: offsets[i]?.top || 0,
                      left: offsets[i]?.left || 0,
                      zIndex: i,
                    };
                    const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
                    return (
                      <Image
                        key={i}
                        source={{ uri: fullUrl }}
                        style={[styles.stackImage, transformStyle]}
                      />
                    );
                  })
                )}
              </View>

              {/* Text Content */}
              <View style={styles.textArea}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.content ? stripMarkdown(item.content).split("。")[0] || "无标题" : "无标题"}
                </Text>
                <Text style={styles.cardExcerpt} numberOfLines={2}>
                  {stripMarkdown(item.content).substring(0, 120)}
                </Text>

                {/* Meta Row */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <IconPark name="camera" size={12} color="#71717A" />
                    <Text style={styles.metaText}>{item.imageCount} 张截图</Text>
                  </View>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{relativeTime(item.updatedAt)}</Text>
                </View>

                {/* Tags */}
                {tagList.length > 0 && (
                  <View style={styles.tagsRow}>
                    {tagList.slice(0, 3).map((tag: string, i: number) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                    {tagList.length > 3 && (
                      <Text style={styles.moreTag}>+{tagList.length - 3}</Text>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={{ marginBottom: 12, opacity: 0.5 }}>
              <IconPark name="write" size={44} color="#A1A1AA" />
            </View>
            <Text style={styles.empty}>还没有笔记</Text>
            <Text style={styles.emptyHint}>导入截图并生成总结后，笔记会出现在这里</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: "700", color: "#18181B" },
  count: { fontSize: 13, fontWeight: "500", color: "#A1A1AA" },
  filterContainer: {
    marginBottom: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: "#F4F4F5",
  },
  filterTagActive: {
    backgroundColor: "#18181B",
  },
  filterTagText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#71717A",
  },
  filterTagTextActive: {
    color: "#FFF",
  },
  list: { paddingHorizontal: 16, paddingBottom: 100 },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ECECEE",
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },

  /* Stacked images */
  imageStackContainer: {
    width: 80,
    height: 90,
    position: "relative",
    flexShrink: 0,
  },
  stackImage: {
    width: 64,
    height: 80,
    borderRadius: 10,
    position: "absolute",
    backgroundColor: "#F4F4F5",
    borderWidth: 1.5,
    borderColor: "#FFF",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stackPlaceholder: {
    position: "absolute",
    top: 4,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Text area */
  textArea: { flex: 1, gap: 4 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#18181B",
    lineHeight: 22,
  },
  cardExcerpt: {
    fontSize: 13,
    color: "#71717A",
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: { fontSize: 12, color: "#71717A" },
  metaDot: { fontSize: 12, color: "#D4D4D8" },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 2 },
  tag: { backgroundColor: "#F4F4F5", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100 },
  tagText: { fontSize: 11, color: "#18181B", fontWeight: "500" },
  moreTag: { fontSize: 11, color: "#A1A1AA", fontWeight: "500", alignSelf: "center" },

  emptyContainer: { alignItems: "center", marginTop: 80 },
  empty: { fontSize: 16, fontWeight: "500", color: "#71717A" },
  emptyHint: { fontSize: 13, color: "#A1A1AA", marginTop: 6, textAlign: "center", paddingHorizontal: 40 },
});
