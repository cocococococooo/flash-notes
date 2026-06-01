import { useCallback, useEffect, useState, useRef } from "react";
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
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import IconPark from "../../components/IconPark";
import { API_BASE_URL } from "../../constants/config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Note {
  id: number;
  projectId: number;
  content: string;
  tags?: string;
  updatedAt: string;
}

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
  const [noteTitle, setNoteTitle] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const loadNote = useCallback(async () => {
    try {
      const data = await api.getNote(projectId);
      setNote(data);
      const parsedBlocks = parseContent(data.content, API_BASE_URL);
      setBlocks(parsedBlocks);
      
      const firstTitle = parsedBlocks.find(b => b.type === "title");
      setNoteTitle(firstTitle?.text || "笔记");
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
      const updated = await api.updateNote(projectId, md);
      setNote(updated);
      Alert.alert("已保存");
    } catch (e: any) {
      Alert.alert("保存失败", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = () => {
    Alert.alert("分享", "分享功能开发中...");
  };

  const updateBlockText = (index: number, text: string) => {
    const copy = [...blocks];
    copy[index] = { ...copy[index], text };
    setBlocks(copy);
  };

  const imageBlocks = blocks.filter(b => b.type === "image" && b.src);
  const textBlocks = blocks.filter(b => b.type !== "image");

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#18181B" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => router.back()}
        >
          <IconPark name="arrowLeft" size={20} color="#18181B" />
        </TouchableOpacity>
        
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {noteTitle}
        </Text>
        
        <View style={styles.topBarActions}>
          <TouchableOpacity 
            style={[styles.actionBtn, saving && styles.actionBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.actionBtnText}>
              {saving ? "保存中..." : "保存"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <IconPark name="share" size={18} color="#18181B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Image Carousel */}
      {imageBlocks.length > 0 && (
        <View style={styles.carouselContainer}>
          <FlatList
            data={imageBlocks}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setCurrentImageIndex(index);
            }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setPreviewImage(item.src!)}
              >
                <Image source={{ uri: item.src }} style={styles.carouselImage} />
              </TouchableOpacity>
            )}
            keyExtractor={(item, index) => `image-${index}`}
          />
          {/* Dots Indicator */}
          <View style={styles.dotsContainer}>
            {imageBlocks.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, index === currentImageIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>
      )}

      {/* Text Content Area */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
      >
        {textBlocks.length === 0 && imageBlocks.length === 0 && (
          <Text style={styles.empty}>开始编辑笔记内容</Text>
        )}
        
        {textBlocks.map((block, i) => {
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
              onChangeText={(val) => updateBlockText(blocks.indexOf(block), val)}
              multiline
              placeholder={
                block.type === "title"
                  ? "输入标题..."
                  : block.type === "subtitle"
                  ? "输入副标题..."
                  : "输入内容..."
              }
              placeholderTextColor="#C4C4C4"
            />
          );
        })}
      </ScrollView>

      {/* Image Preview Modal */}
      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.modalBg}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setPreviewImage(null)}
          >
            <IconPark name="close" size={24} color="#FFF" />
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 12,
    backgroundColor: "#FAFAFA",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0EE",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  topBarTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#18181B",
    textAlign: "center",
    marginHorizontal: 12,
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    backgroundColor: "#18181B",
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  carouselContainer: {
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0EE",
    justifyContent: "center",
    alignItems: "center",
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: 300,
    resizeMode: "contain",
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D4D4D8",
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: "#18181B",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  empty: {
    textAlign: "center",
    color: "#A1A1AA",
    marginTop: 60,
    fontSize: 15,
  },
  titleText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#18181B",
    marginBottom: 8,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#18181B",
    marginTop: 24,
    marginBottom: 10,
    lineHeight: 28,
  },
  headingText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#27272A",
    marginTop: 18,
    marginBottom: 8,
    lineHeight: 24,
  },
  paragraphText: {
    fontSize: 16,
    color: "#3F3F46",
    lineHeight: 26,
    marginBottom: 8,
  },
  listItemText: {
    fontSize: 16,
    color: "#3F3F46",
    lineHeight: 24,
    paddingLeft: 16,
    marginBottom: 6,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalClose: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "90%",
    height: "70%",
  },
});
