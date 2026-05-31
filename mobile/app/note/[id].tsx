import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import IconPark from "../../components/IconPark";
import { API_BASE_URL } from "../../constants/config";

interface Note {
  id: number;
  projectId: number;
  content: string;
  tags: string;
  updatedAt: string;
}

// Minimal Markdown to editable blocks
interface Block {
  type: "title" | "subtitle" | "heading" | "paragraph" | "image" | "listItem";
  text: string;
  src?: string;
}

function parseContent(md: string, baseUrl: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const imgMatch = trimmed.match(/^!\[.*?\]\((.+?)\)$/);
    if (imgMatch) {
      const src = imgMatch[1].startsWith("/") ? `${baseUrl}${imgMatch[1]}` : imgMatch[1];
      blocks.push({ type: "image", text: "", src });
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push({ type: "title", text: trimmed.replace(/^#\s+/, "") });
    } else if (trimmed.startsWith("## ")) {
      blocks.push({ type: "subtitle", text: trimmed.replace(/^##\s+/, "") });
    } else if (trimmed.startsWith("### ")) {
      blocks.push({ type: "heading", text: trimmed.replace(/^###\s+/, "") });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push({ type: "listItem", text: trimmed.replace(/^[-*]\s+/, "") });
    } else {
      blocks.push({ type: "paragraph", text: trimmed });
    }
  }
  return blocks;
}

function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "title": return `# ${b.text}`;
        case "subtitle": return `## ${b.text}`;
        case "heading": return `### ${b.text}`;
        case "listItem": return `- ${b.text}`;
        case "image": return `![image](${b.src})`;
        default: return b.text;
      }
    })
    .join("\n");
}

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = parseInt(id, 10);
  const router = useRouter();

  const [note, setNote] = useState<Note | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [showTagsInput, setShowTagsInput] = useState(false);

  const loadNote = useCallback(async () => {
    try {
      const data = await api.getNote(projectId);
      setNote(data);
      setBlocks(parseContent(data.content, API_BASE_URL));
      let tagList: string[] = [];
      try { tagList = JSON.parse(data.tags); } catch {}
      setTagsInput(tagList.join(", "));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const md = blocksToMarkdown(blocks);
      const tagList = tagsInput.split(/[,，]/).map(t => t.trim()).filter(Boolean);
      const tags = JSON.stringify(tagList);
      const updated = await api.updateNote(projectId, md, tags);
      setNote(updated);
      Alert.alert("已保存");
    } catch (e: any) {
      Alert.alert("保存失败", e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateBlockText = (index: number, text: string) => {
    const copy = [...blocks];
    copy[index] = { ...copy[index], text };
    setBlocks(copy);
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
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <IconPark name="arrowLeft" size={16} color="#18181B" />
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.disabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? "保存中..." : "保存"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {blocks.length === 0 && (
          <Text style={styles.empty}>暂无笔记内容</Text>
        )}
        {blocks.map((block, i) => {
          if (block.type === "image" && block.src) {
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setPreviewImage(block.src!)}
              >
                <Image source={{ uri: block.src }} style={styles.inlineImage} />
              </TouchableOpacity>
            );
          }

          const textStyle =
            block.type === "title"
              ? styles.titleText
              : block.type === "subtitle"
              ? styles.subtitleText
              : block.type === "heading"
              ? styles.headingText
              : block.type === "listItem"
              ? styles.listItemText
              : styles.paragraphText;

          return (
            <TextInput
              key={i}
              style={textStyle}
              value={block.text}
              onChangeText={(val) => updateBlockText(i, val)}
              multiline
              placeholder={block.type === "title" ? "输入标题..." : "输入内容..."}
              placeholderTextColor="#CCC"
            />
          );
        })}

        {/* Tags Section */}
        <View style={styles.tagsSection}>
          <TouchableOpacity onPress={() => setShowTagsInput(!showTagsInput)}>
            <Text style={styles.tagsLabel}>
              标签 {showTagsInput ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>
          {showTagsInput && (
            <TextInput
              style={styles.tagsInput}
              value={tagsInput}
              onChangeText={setTagsInput}
              placeholder="输入标签，用逗号分隔"
              placeholderTextColor="#AAA"
            />
          )}
          <View style={styles.tagsRow}>
            {tagsInput.split(/[,，]/).map(t => t.trim()).filter(Boolean).map((tag, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.modalBg}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setPreviewImage(null)}
          >
            <Text style={styles.modalCloseText}>关闭</Text>
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0EE",
    backgroundColor: "#FAFAFA",
  },
  backText: { fontSize: 15, color: "#18181B", fontWeight: "600" },
  saveBtn: {
    backgroundColor: "#18181B",
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  saveBtnText: { color: "#FFF", fontWeight: "600", fontSize: 14 },
  disabled: { opacity: 0.5 },
  content: { padding: 20, paddingBottom: 60 },
  empty: { textAlign: "center", color: "#A1A1AA", marginTop: 40 },
  titleText: {
    fontSize: 26,
    fontWeight: "800",
    color: "#18181B",
    marginBottom: 6,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#27272A",
    marginTop: 20,
    marginBottom: 10,
    lineHeight: 26,
  },
  headingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3F3F46",
    marginTop: 14,
    marginBottom: 8,
    lineHeight: 22,
  },
  paragraphText: {
    fontSize: 15,
    color: "#52525B",
    lineHeight: 26,
    marginBottom: 10,
  },
  listItemText: {
    fontSize: 15,
    color: "#52525B",
    lineHeight: 24,
    paddingLeft: 16,
    marginBottom: 6,
  },
  inlineImage: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginVertical: 12,
    resizeMode: "cover",
  },
  tagsSection: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#F0F0EE" },
  tagsLabel: { fontSize: 11, fontWeight: "600", color: "#A1A1AA", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 },
  tagsInput: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 10, padding: 10, fontSize: 14, color: "#18181B", marginBottom: 10, backgroundColor: "#FFF" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "#F4F4F5", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 },
  tagText: { fontSize: 12, color: "#18181B", fontWeight: "500" },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(24,24,27,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modalCloseText: { color: "#FFF", fontSize: 14, fontWeight: "500" },
  previewImage: { width: "90%", height: "70%" },
});
