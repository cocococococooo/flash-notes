import { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

interface ImageCardData {
  id: number;
  localUri: string;
  ocrText: string;
  aiSummary: string;
  userSummary: string;
  tags: string;
  status: string;
}

interface Props {
  image: ImageCardData;
  baseUrl: string;
  onUpdate: (id: number, data: { userSummary?: string; tags?: string }) => void;
}

export default function ImageCard({ image, baseUrl, onUpdate }: Props) {
  const [ocrExpanded, setOcrExpanded] = useState(false);
  const [summary, setSummary] = useState(image.userSummary || image.aiSummary);
  const [tagsText, setTagsText] = useState(
    JSON.parse(image.tags || "[]").join(", ")
  );
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingTags, setEditingTags] = useState(false);

  const imgUri = image.localUri.startsWith("http")
    ? image.localUri
    : image.localUri.startsWith("/")
    ? `${baseUrl}${image.localUri}`
    : `file:///${image.localUri.replace(/\\/g, "/")}`;

  const handleSaveSummary = () => {
    setEditingSummary(false);
    onUpdate(image.id, { userSummary: summary });
  };

  const handleSaveTags = () => {
    setEditingTags(false);
    const tagList = tagsText
      .split(/[,，]/)
      .map((t: string) => t.trim())
      .filter(Boolean);
    onUpdate(image.id, { tags: JSON.stringify(tagList) });
  };

  return (
    <View style={styles.card}>
      <Image source={{ uri: imgUri }} style={styles.image} />

      {image.status === "processing" && (
        <View style={styles.overlay}>
          <ActivityIndicator color="#FFF" size="small" />
          <Text style={styles.overlayText}>分析中...</Text>
        </View>
      )}

      {image.status === "failed" && (
        <View style={styles.overlayError}>
          <Text style={styles.overlayText}>分析失败</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => onUpdate(image.id, {})}
          >
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}

      {image.status === "done" && (
        <View style={styles.content}>
          <TouchableOpacity onPress={() => setOcrExpanded(!ocrExpanded)}>
            <Text style={styles.ocrToggle}>
              {ocrExpanded ? "收起原文" : "展开原文"}
            </Text>
          </TouchableOpacity>
          {ocrExpanded && (
            <Text style={styles.ocrText}>{image.ocrText}</Text>
          )}

          <Text style={styles.label}>AI 要点</Text>
          {editingSummary ? (
            <TextInput
              style={styles.editInput}
              value={summary}
              onChangeText={setSummary}
              onBlur={handleSaveSummary}
              autoFocus
              multiline
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingSummary(true)}>
              <Text style={styles.summaryText}>{summary}</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>标签</Text>
          {editingTags ? (
            <TextInput
              style={styles.editInput}
              value={tagsText}
              onChangeText={setTagsText}
              onBlur={handleSaveTags}
              autoFocus
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingTags(true)}>
              <View style={styles.tagsRow}>
                {JSON.parse(image.tags || "[]").map((tag: string, i: number) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F0EE",
  },
  image: { width: "100%", height: 200, resizeMode: "cover" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(24,24,27,0.6)",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    top: 200,
  },
  overlayError: {
    backgroundColor: "#FFF",
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  overlayText: { color: "#FFF", fontSize: 14, fontWeight: "500" },
  retryBtn: {
    backgroundColor: "#FFF",
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: "#18181B", fontWeight: "600" },
  content: { padding: 16 },
  ocrToggle: { color: "#18181B", fontSize: 13, marginBottom: 6, fontWeight: "500" },
  ocrText: {
    fontSize: 13,
    color: "#71717A",
    lineHeight: 20,
    marginBottom: 14,
    backgroundColor: "#F4F4F5",
    padding: 12,
    borderRadius: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: "#A1A1AA",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 12,
    marginBottom: 6,
  },
  summaryText: { fontSize: 15, color: "#18181B", lineHeight: 24 },
  editInput: {
    borderWidth: 1.5,
    borderColor: "#18181B",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#18181B",
    backgroundColor: "#FFF",
    lineHeight: 20,
  },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: "#EEF0FF",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tagText: { fontSize: 12, color: "#18181B", fontWeight: "500" },
});
