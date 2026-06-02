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
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import IconPark from "../../components/IconPark";
import { API_BASE_URL } from "../../constants/config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const WRAPPER_PADDING = 12;
const CARD_WIDTH = SCREEN_WIDTH - WRAPPER_PADDING * 2;
const CARD_HEIGHT = CARD_WIDTH * 1.4;
const CARD_SPACING = 12;

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
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");
  const tagSlideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (tagModalVisible) {
      tagSlideAnim.setValue(300);
      Animated.spring(tagSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    }
  }, [tagModalVisible, tagSlideAnim]);
  const scrollViewRef = useRef<ScrollView>(null);
  const carouselRef = useRef<Animated.FlatList<Block>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const goToImage = (index: number) => {
    if (index < 0 || index >= imageBlocks.length) return;
    carouselRef.current?.scrollToOffset({
      offset: index * (CARD_WIDTH + CARD_SPACING),
      animated: true,
    });
    setCurrentImageIndex(index);
  };

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

  const tagColorPalette = [
    { bg: '#FDECD6', text: '#C57C00' },  // orange
    { bg: '#D6EAFF', text: '#1A73E8' },  // blue
    { bg: '#E4D6F5', text: '#7C4DFF' },  // purple
    { bg: '#F5EED6', text: '#8B6914' },  // beige
    { bg: '#D6F5E8', text: '#0A7A3E' },  // green
    { bg: '#F5D6D6', text: '#D32F2F' },  // pink
    { bg: '#E4E4E7', text: '#52525B' },  // gray
    { bg: '#FFF3CD', text: '#856404' },  // yellow
  ];

  const getTagColors = (tag: string) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = ((hash << 5) - hash) + tag.charCodeAt(i);
      hash |= 0;
    }
    return tagColorPalette[Math.abs(hash) % tagColorPalette.length];
  };

  const handleAddTag = () => {
    setTagInputValue("");
    setTagModalVisible(true);
  };

  const confirmTag = () => {
    const tag = tagInputValue.trim();
    if (!tag || !note) return;
    const raw = note.tags || '';
    let tagList: string[] = [];
    try { tagList = JSON.parse(raw); } catch { tagList = raw.split(',').map(t => t.trim()).filter(Boolean); }
    if (tagList.indexOf(tag) === -1) {
      tagList.push(tag);
      setNote({ ...note, tags: JSON.stringify(tagList) });
    }
    setTagModalVisible(false);
    setTagInputValue("");
  };

  const removeTag = (tag: string) => {
    if (!note) return;
    const raw = note.tags || '';
    let tagList: string[] = [];
    try { tagList = JSON.parse(raw); } catch { tagList = raw.split(',').map(t => t.trim()).filter(Boolean); }
    const idx = tagList.indexOf(tag);
    if (idx !== -1) {
      tagList.splice(idx, 1);
      setNote({ ...note, tags: JSON.stringify(tagList) });
    }
  };

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

  const renderImageCard = ({ item, index }: { item: Block; index: number }) => {
    const inputRange = [
      (index - 1) * (CARD_WIDTH + CARD_SPACING),
      index * (CARD_WIDTH + CARD_SPACING),
      (index + 1) * (CARD_WIDTH + CARD_SPACING),
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.85, 1, 0.85],
      extrapolate: "clamp",
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4],
      extrapolate: "clamp",
    });

    return (
      <Animated.View
        style={[
          styles.cardWrapper,
          {
            width: CARD_WIDTH,
            transform: [{ scale }],
            opacity,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => setPreviewImage(item.src!)}
          style={styles.card}
        >
          <Image source={{ uri: item.src }} style={styles.cardImage} />
          <View style={styles.cardOverlay} />
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>{index + 1}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

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
          <IconPark name="arrowLeft" size={18} color="#18181B" />
          <Text style={styles.backBtnText}>返回</Text>
        </TouchableOpacity>
        
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
          {!saving && (
            <TouchableOpacity style={styles.shareIconBtn} onPress={handleShare}>
              <IconPark name="share" size={20} color="#18181B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card Container */}
        <View style={styles.mainCard}>
          {/* Image Carousel Section */}
          {imageBlocks.length > 0 && (
            <View style={styles.carouselSection}>
              <View style={styles.carouselContainer}>
                <Animated.FlatList
                  ref={carouselRef}
                  data={imageBlocks}
                  horizontal
                  pagingEnabled={false}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselContent}
                  snapToInterval={CARD_WIDTH + CARD_SPACING}
                  decelerationRate="fast"
                  onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: true }
                  )}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(
                      e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_SPACING)
                    );
                    if (index !== currentImageIndex && index >= 0 && index < imageBlocks.length) {
                      setCurrentImageIndex(index);
                    }
                  }}
                  renderItem={renderImageCard}
                  keyExtractor={(item, index) => `image-${index}`}
                />
              </View>
            </View>
          )}

          {/* Content Card */}
          <View style={styles.contentCard}>
            {/* Text Pill - folder name */}
            <View style={styles.ncTextPill}>
              <IconPark name="folder" size={14} color="#4F4F4F" />
              <Text style={styles.ncPillText}>{noteTitle}</Text>
            </View>

            {/* Image Title */}
            {textBlocks.filter(b => b.type === "title").length > 0 ? (
              textBlocks.filter(b => b.type === "title").map((block, i) => (
                <TextInput
                  key={`title-${i}`}
                  style={styles.ncImageTitle}
                  value={block.text}
                  onChangeText={(val) => updateBlockText(blocks.indexOf(block), val)}
                  multiline
                  placeholder="Enter title..."
                  placeholderTextColor="#C4C4C4"
                />
              ))
            ) : (
              <TextInput
                style={styles.ncImageTitle}
                value={noteTitle}
                onChangeText={() => {}}
                multiline
                placeholder="Enter title..."
                placeholderTextColor="#C4C4C4"
              />
            )}

            {/* OCR Section */}
            <View style={styles.ncOcrSection}>
              {textBlocks.filter(b => b.type !== "title").length > 0 ? (
                textBlocks.filter(b => b.type !== "title").map((block, i) => (
                  <TextInput
                    key={`body-${i}`}
                    style={styles.ncOcrText}
                    value={block.text}
                    onChangeText={(val) => updateBlockText(blocks.indexOf(block), val)}
                    multiline
                    placeholder="OCR text..."
                    placeholderTextColor="#C4C4C4"
                  />
                ))
              ) : (
                <TextInput
                  style={styles.ncOcrText}
                  value=""
                  editable={false}
                  multiline
                  placeholder="No text extracted yet."
                  placeholderTextColor="#C4C4C4"
                />
              )}
              <TouchableOpacity style={styles.ncOcrRetry} onPress={() => {}}>
                <IconPark name="refresh" size={12} color="#52525B" />
                <Text style={styles.ncOcrRetryText}>重新识别</Text>
              </TouchableOpacity>
            </View>

            {/* Tags */}
            <View style={styles.ncTagsRow}>
              {note?.tags ? (
                (() => {
                  const raw = note.tags || '';
                  let list: string[] = [];
                  try { list = JSON.parse(raw); } catch { list = raw.split(',').map(t => t.trim()).filter(Boolean); }
                  return list.map((tag, i) => {
                    const colors = getTagColors(tag);
                    return (
                      <View key={i} style={[styles.ncBadgeElement, { backgroundColor: colors.bg }]}>
                        <Text style={[styles.ncBadgeText, { color: colors.text }]}>{tag}</Text>
                        <TouchableOpacity
                          style={styles.ncBadgeRemove}
                          onPress={() => removeTag(tag)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={[styles.ncBadgeRemoveText, { color: colors.text }]}>×</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  });
                })()
              ) : (
                <Text style={styles.ncBadgePlaceholder}>No tags</Text>
              )}
              <TouchableOpacity style={styles.ncAddTagBtn} onPress={handleAddTag}>
                <Text style={styles.ncAddTagBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Dots Indicator */}
        {imageBlocks.length > 0 && (
          <View style={styles.dotsContainer}>
            {imageBlocks.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => goToImage(index)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.dot,
                    index === currentImageIndex && styles.dotActive,
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacer} />
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

      {/* Tag Bottom Sheet */}
      <Modal visible={tagModalVisible} transparent animationType="none" onRequestClose={() => setTagModalVisible(false)}>
        <TouchableOpacity
          style={styles.tagSheetBg}
          activeOpacity={1}
          onPress={() => setTagModalVisible(false)}
        >
          <Animated.View
            style={[
              styles.tagSheetCard,
              { transform: [{ translateY: tagSlideAnim }] },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={styles.tagSheetHandle} />
              <Text style={styles.tagSheetTitle}>Add Tag</Text>
              <TextInput
                style={styles.tagSheetInput}
                value={tagInputValue}
                onChangeText={setTagInputValue}
                placeholder="Enter tag name..."
                placeholderTextColor="#C4C4C4"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={confirmTag}
              />
              <View style={styles.tagSheetActions}>
                <TouchableOpacity style={styles.tagSheetCancel} onPress={() => setTagModalVisible(false)}>
                  <Text style={styles.tagSheetCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tagSheetConfirm} onPress={confirmTag}>
                  <Text style={styles.tagSheetConfirmText}>Add</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E5E5E5",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#18181B",
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181B",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
  },
  shareIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0.602 },
    shadowOpacity: 0.08,
    shadowRadius: 2.29,
    elevation: 3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* Main Card Container */
  mainCard: {
    marginTop: 4,
    marginBottom: 16,
    backgroundColor: "#F0F0F0",
    width: SCREEN_WIDTH,
    borderRadius: 20,
    padding: WRAPPER_PADDING,
    gap: 12,
  },

  /* Carousel Section */
  carouselSection: {
    padding: 0,
    overflow: "hidden",
    position: "relative",
  },
  carouselContainer: {
    overflow: "hidden",
  },
  carouselContent: {
    alignItems: "center",
  },
  imageCard: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.5,
    borderRadius: 17,
    overflow: "hidden",
    marginHorizontal: CARD_SPACING / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0.602187 },
    shadowOpacity: 0.08,
    shadowRadius: 0.602187,
    elevation: 3,
  },
  imageContainer: {
    width: "100%",
    height: "100%",
  },
  imageStyle: {
    width: "100%",
    height: "100%",
    borderRadius: 17,
  },
  cardWrapper: {
    marginRight: CARD_SPACING,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.5,
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0.602187 },
    shadowOpacity: 0.08,
    shadowRadius: 0.602187,
    elevation: 3,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  cardBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBadgeText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#18181B",
  },

  /* Content Card */
  contentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0.602187 },
    shadowOpacity: 0.08,
    shadowRadius: 0.602187,
    elevation: 3,
  },

  /* Text Pill - folder name */
  ncTextPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(0,0,0,0.2)",
    borderRadius: 25,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 12,
    gap: 4,
  },
  ncPillText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4F4F4F",
    letterSpacing: 0.3,
  },

  /* Image Title */
  ncImageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#18181B",
    marginBottom: 12,
    lineHeight: 30,
    paddingVertical: 0,
  },

  /* OCR Section */
  ncOcrSection: {
    marginBottom: 16,
  },
  ncOcrText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#52525B",
    minHeight: 60,
    paddingVertical: 0,
  },
  ncOcrRetry: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    backgroundColor: "#FFFFFF",
  },
  ncOcrRetryText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#52525B",
  },

  /* Tags */
  ncTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    alignItems: "center",
    marginTop: 16,
  },
  ncBadgeElement: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    gap: 4,
  },
  ncBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  ncBadgeRemove: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.6,
  },
  ncBadgeRemoveText: {
    fontSize: 16,
    fontWeight: "600",
  },
  ncBadgePlaceholder: {
    fontSize: 13,
    fontWeight: "500",
    color: "#A1A1AA",
  },
  ncAddTagBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
  },
  ncAddTagBtnText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#52525B",
  },

  /* Dots Indicator */
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#A1A1AA",
  },
  dotActive: {
    width: 20,
    backgroundColor: "#18181B",
  },
  bottomSpacer: {
    height: 60,
  },

  /* Modal */
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
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "90%",
    height: "70%",
  },

  /* Tag Bottom Sheet */
  tagSheetBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  tagSheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  tagSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E4E4E7",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 16,
  },
  tagSheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#18181B",
    marginBottom: 16,
    textAlign: "center",
  },
  tagSheetInput: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#18181B",
    backgroundColor: "#F4F4F5",
    marginBottom: 16,
  },
  tagSheetActions: {
    flexDirection: "row",
    gap: 10,
  },
  tagSheetCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
  },
  tagSheetCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#52525B",
  },
  tagSheetConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: "#18181B",
    alignItems: "center",
  },
  tagSheetConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
