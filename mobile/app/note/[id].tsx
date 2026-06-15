import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  BackHandler,
  Image,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Keyboard,
  Animated,
  Dimensions,
  Easing,
  PanResponder,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../services/api";
import { pickImages } from "../../services/imageUtils";
import IconPark from "../../components/IconPark";
import { API_BASE_URL, POLL_INTERVAL_MS } from "../../constants/config";
import { addRecentNote } from "../../services/recentNotes";
import * as Clipboard from "expo-clipboard";
import { captureRef } from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import Pdf from "react-native-pdf";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const WRAPPER_PADDING = 8;
const CAPTURE_PADDING = 16;
const CARD_WIDTH = SCREEN_WIDTH - CAPTURE_PADDING * 2 - WRAPPER_PADDING * 2;

const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });

interface Note {
  id: number;
  projectId: number;
  title: string;
  content: string;
  tags?: string;
  updatedAt: string;
}

interface ImageItem {
  id: number;
  projectId: number;
  localUri: string;
  width: number;
  height: number;
  ocrText: string;
  aiSummary: string;
  userSummary: string;
  tags: string;
  status: string;
}

function resolveImageUri(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("http")) return uri;
  if (uri.startsWith("/")) return `${API_BASE_URL}${uri}`;
  return `file:///${uri.replace(/\\/g, "/")}`;
}

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

export default function NoteScreen() {
  const { id: noteIdParam, fromRecent } = useLocalSearchParams<{ id: string; fromRecent?: string }>();
  const noteId = parseInt(noteIdParam, 10);
  const isFromRecent = fromRecent === "true";
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const CARD_HEIGHT = useMemo(() => {
    const topBarHeight = insets.top + 8 + 12 + 30;
    const capturePadding = CAPTURE_PADDING * 2;
    const wrapperPadding = WRAPPER_PADDING * 2;
    const mainCardMargin = 16;
    const dotsHeight = 30;
    const bottomSpacing = 40;
    return Math.max(
      300,
      SCREEN_HEIGHT - insets.top - insets.bottom - topBarHeight - capturePadding - wrapperPadding - mainCardMargin - dotsHeight - bottomSpacing + 90
    );
  }, [insets.top, insets.bottom]);

  const CARD_IMAGE_HEIGHT = useMemo(
    () => Math.round(CARD_WIDTH * 0.75),
    [CARD_HEIGHT]
  );

  const [note, setNote] = useState<Note | null>(null);
  const [projectId, setProjectId] = useState<number>(0);
  const [projectTitle, setProjectTitle] = useState("笔记");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const [editableTitle, setEditableTitle] = useState("");
  const [editableOcr, setEditableOcr] = useState("");
  const [noteTags, setNoteTags] = useState<string[]>([]);

  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");
  const [tagInputVisible, setTagInputVisible] = useState(false);
  const [tagInputFocused, setTagInputFocused] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [previewShareImage, setPreviewShareImage] = useState<string | null>(null);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const shareSheetAnim = useRef(new Animated.Value(400)).current;

  const [saveProjects, setSaveProjects] = useState<{ id: number; title: string }[]>([]);
  const [selectedSaveProjectId, setSelectedSaveProjectId] = useState<number | null>(null);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  const captureViewRef = useRef<View>(null);
  const slidesScrollRef = useRef<ScrollView>(null);
  const sheetAnim = useRef(new Animated.Value(400)).current;
  const tagSheetAnim = useRef(new Animated.Value(400)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const editableTitleInitialized = useRef(false);

  const getImageHeight = useCallback(
    (img: ImageItem) => {
      if (img.width > 0 && img.height > 0) {
        const ratio = img.height / img.width;
        return Math.round(CARD_WIDTH * ratio);
      }
      return CARD_IMAGE_HEIGHT;
    },
    [CARD_WIDTH]
  );

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    if (saveModalVisible) {
      sheetAnim.setValue(400);
      Animated.timing(sheetAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }).start();
    }
  }, [saveModalVisible, sheetAnim]);

  useEffect(() => {
    if (tagInputVisible) {
      tagSheetAnim.setValue(400);
      Animated.timing(tagSheetAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }).start();
    }
  }, [tagInputVisible, tagSheetAnim]);

  useEffect(() => {
    if (shareModalVisible) {
      shareSheetAnim.setValue(400);
      Animated.timing(shareSheetAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }).start();
    }
  }, [shareModalVisible, shareSheetAnim]);

  const loadAll = useCallback(async () => {
    try {
      const noteData = await api.getNoteById(noteId).catch(() => null);
      setNote(noteData);
      const pid = noteData?.projectId ?? 0;
      setProjectId(pid);

      const [imageData, projects] = await Promise.all([
        api.listImages(pid, noteId).catch(() => []),
        api.listProjects().catch(() => []),
      ]);

      const proj = projects.find((p: any) => p.id === pid);
      if (proj) setProjectTitle(proj.title);

      setImages(imageData);

      try {
        const tags = noteData?.tags ? JSON.parse(noteData.tags) : [];
        setNoteTags(Array.isArray(tags) ? tags : []);
      } catch {
        setNoteTags([]);
      }
      addRecentNote(noteData?.id ?? noteId, pid, noteData?.title || "笔记", imageData.length);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    loadAll();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadAll]);

  const startPolling = useCallback((pid?: number, nid?: number) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const data = await api.listImages(pid ?? projectId, nid ?? noteId);
        setImages(data);
        if (data.every((img) => img.status !== "processing")) {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (e) {
        console.error(e);
      }
    }, POLL_INTERVAL_MS);
  }, [projectId, noteId]);

  useEffect(() => {
    if (images.some((img) => img.status === "processing") && !pollingRef.current) {
      startPolling();
    }
  }, [images, startPolling]);

  useEffect(() => {
    const img = images[currentIndex];
    setEditableOcr(img?.ocrText || "");
    setHasUnsavedChanges(false);
  }, [currentIndex, images]);

  const onOcrChange = (text: string) => {
    setEditableOcr(text);
    setHasUnsavedChanges(text !== (images[currentIndex]?.ocrText || ""));
  };

  const onTitleChange = (text: string) => {
    setEditableTitle(text);
    setHasUnsavedChanges(text !== projectTitle);
  };

  useEffect(() => {
    if (editableTitleInitialized.current) return;
    if (note?.title) {
      setEditableTitle(note.title);
      editableTitleInitialized.current = true;
    } else if (projectTitle) {
      setEditableTitle(projectTitle);
      editableTitleInitialized.current = true;
    }
  }, [note?.title, projectTitle]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onBack = () => {
      if (!hasUnsavedChanges) return false;
      Alert.alert("未保存的修改", "您有未保存的修改，确定要离开吗？", [
        { text: "继续编辑", style: "cancel", onPress: () => {} },
        {
          text: "放弃修改",
          style: "destructive",
          onPress: () => {
            setHasUnsavedChanges(false);
            if (isFromRecent) {
              router.replace("/(tabs)");
            } else {
              router.back();
            }
          },
        },
      ]);
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [hasUnsavedChanges, isFromRecent, router]);

  const scrollToSlide = (idx: number) => {
    const cardW = SCREEN_WIDTH - (CAPTURE_PADDING + WRAPPER_PADDING) * 2;
    slidesScrollRef.current?.scrollTo({ x: idx * cardW, animated: true });
  };

  const goNextImage = () => {
    if (currentIndex < images.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      scrollToSlide(next);
    }
  };

  const goPrevImage = () => {
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      scrollToSlide(prev);
    }
  };

  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const contentTouchStart = (e: any) => {
    swipeStartX.current = e.nativeEvent.locationX;
    swipeStartY.current = e.nativeEvent.locationY;
  };
  const contentTouchEnd = (e: any) => {
    const dx = e.nativeEvent.locationX - swipeStartX.current;
    const dy = e.nativeEvent.locationY - swipeStartY.current;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNextImage();
      else goPrevImage();
    }
  };

  const handleOpenSaveModal = async () => {
    setSaveModalVisible(true);
    setSelectedSaveProjectId(projectId);
    try {
      const projects = await api.listProjects().catch(() => []);
      setSaveProjects(projects.map((p) => ({ id: p.id, title: p.title })));
    } catch {
      setSaveProjects([]);
    }
  };
  const closeSaveModal = () => {
    Animated.timing(sheetAnim, { toValue: 400, duration: 200, useNativeDriver: true }).start(() => {
      setSaveModalVisible(false);
      setShowNewProjectInput(false);
      setNewProjectName("");
    });
  };

  const handleCreateProjectInSave = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setCreatingProject(true);
    try {
      const project = await api.createProject(name);
      setSaveProjects((prev) => [{ id: project.id, title: project.title }, ...prev]);
      setSelectedSaveProjectId(project.id);
      setShowNewProjectInput(false);
      setNewProjectName("");
    } catch (e: any) {
      Alert.alert("创建失败", e.message);
    } finally {
      setCreatingProject(false);
    }
  };

  const addTag = () => {
    const t = tagInputValue.trim();
    if (!t) return;
    if (!noteTags.includes(t)) {
      setNoteTags([...noteTags, t]);
    }
    setTagInputValue("");
    setTagInputVisible(false);
  };

  const removeTag = (tag: string) => {
    setNoteTags(noteTags.filter((t) => t !== tag));
  };

  const confirmSave = async () => {
    if (!selectedSaveProjectId) {
      Alert.alert("请先选择一个项目");
      return;
    }
    setSaving(true);
    try {
      await api.updateNote(selectedSaveProjectId, note?.content || " ", JSON.stringify(noteTags));
      setHasUnsavedChanges(false);
      closeSaveModal();
      Alert.alert("已保存", "笔记已更新");
    } catch (e: any) {
      console.error("Save failed:", e.message);
      Alert.alert("保存失败", e.message || "未知错误");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = () => {
    setShareModalVisible(true);
  };

  const handleShareLink = async () => {
    try {
      const result = await api.createShareLink(projectId);
      await Clipboard.setStringAsync(result.url);
      Alert.alert("已复制", "分享链接已复制到剪贴板");
    } catch (e: any) {
      Alert.alert("生成失败", e.message);
    }
  };

  const handleShareImage = async () => {
    try {
      if (!captureViewRef.current) {
        Alert.alert("错误", "无法截取内容");
        return;
      }
      const uri = await captureRef(captureViewRef.current, { format: "png", quality: 1 });
      setPreviewShareImage(uri);
    } catch (e: any) {
      Alert.alert("截图失败", e.message);
    }
  };

  const confirmSaveImage = async () => {
    if (!previewShareImage) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("权限不足", "需要相册访问权限才能保存图片");
        return;
      }
      await MediaLibrary.saveToLibraryAsync(previewShareImage);
      Alert.alert("已保存", "图片已保存到相册");
      setPreviewShareImage(null);
    } catch (e: any) {
      Alert.alert("保存失败", e.message);
    }
  };

  const handleSharePdf = async () => {
    try {
      const html = generatePdfHtml();
      const { uri } = await Print.printToFileAsync({ html });
      setPdfUri(uri);
      setShowPdfPreview(true);
    } catch (e: any) {
      Alert.alert("生成失败", e.message);
    }
  };

  const generatePdfHtml = () => {
    const imagesHtml = images
      .map((img) => `<img src="${resolveImageUri(img.localUri)}" style="width:100%;border-radius:8px;margin:12px 0;" />`)
      .join("");
    const textHtml = `<p style="font-size:18px;font-weight:700;color:#18181B;margin-bottom:12px;">${editableTitle || projectTitle}</p>${images
      .map((img) => `<p style="font-size:15px;line-height:1.8;margin-bottom:10px;color:#52525B;">${(img.ocrText || "").replace(/</g, "&lt;")}</p>`)
      .join("")}`;
    const tagsHtml = noteTags
      .map((tag) => `<span style="display:inline-block;background:#F4F4F5;padding:4px 12px;border-radius:100px;margin:4px;font-size:13px;color:#18181B;">${tag}</span>`)
      .join("");
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">
      <style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 20px; color: #333; }
      * { margin: 0; padding: 0; box-sizing: border-box; }</style>
      </head>
      <body>${imagesHtml}${textHtml}<div style="margin-top:20px;">${tagsHtml}</div></body>
      </html>
    `;
  };

  const handleSavePdf = async () => {
    if (!pdfUri) return;
    try {
      await Sharing.shareAsync(pdfUri, { mimeType: "application/pdf", dialogTitle: "保存PDF" });
      setShowPdfPreview(false);
      setPdfUri(null);
    } catch (e: any) {
      Alert.alert("保存失败", e.message);
    }
  };

  const handleShareOption = async (option: string) => {
    setShareModalVisible(false);
    const text = `${editableTitle}\n\n${images.map((img) => img.ocrText).join("\n\n")}`;
    switch (option) {
      case "text":
        await Clipboard.setStringAsync(text);
        Alert.alert("已复制", "文字内容已复制到剪贴板");
        break;
      case "image":
        handleShareImage();
        break;
      case "pdf":
        handleSharePdf();
        break;
      case "link":
        handleShareLink();
        break;
    }
  };

  const currentImage = images[currentIndex];
  const totalImages = images.length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#18181B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Top Navigation Bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (hasUnsavedChanges) {
                Alert.alert("未保存的修改", "您有未保存的修改，确定要离开吗？", [
                  { text: "继续编辑", style: "cancel" },
                  {
                    text: "放弃修改",
                    style: "destructive",
                    onPress: () => {
                      setHasUnsavedChanges(false);
                      if (isFromRecent) {
                        router.replace("/(tabs)");
                      } else {
                        router.back();
                      }
                    },
                  },
                ]);
              } else {
                if (isFromRecent) {
                  router.replace("/(tabs)");
                } else {
                  router.back();
                }
              }
            }}
          >
            <IconPark name="arrowLeft" size={16} color="#18181B" />
            <Text style={styles.backBtnText} numberOfLines={1}>{editableTitle || "笔记"}</Text>
            {hasUnsavedChanges && <View style={styles.unsavedDot} />}
          </TouchableOpacity>

          <View style={styles.topBarActions}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleOpenSaveModal} disabled={saving}>
              <Text style={styles.saveBtnText}>保存</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareIconBtn} onPress={handleShare}>
              <IconPark name="share" size={20} color="#18181B" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View ref={captureViewRef} style={styles.captureArea}>
            <View style={styles.mainCard}>
              {/* Image carousel - horizontal scroll per slide (HTML structure) */}
              {totalImages > 0 ? (
                <View style={[styles.slidesTrack, { height: CARD_HEIGHT }]}>
                  <ScrollView
                    ref={slidesScrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => {
                      const cardW = SCREEN_WIDTH - (CAPTURE_PADDING + WRAPPER_PADDING) * 2;
                      const idx = Math.round(e.nativeEvent.contentOffset.x / cardW);
                      if (idx !== currentIndex && idx >= 0 && idx < totalImages) {
                        setCurrentIndex(idx);
                      }
                    }}
                  >
                    {images.map((img, i) => {
                      const isActive = i === currentIndex;
                      return (
                        <View key={img.id} style={[styles.noteSlide, { height: CARD_HEIGHT }]}>
                          <TouchableOpacity
                            activeOpacity={0.95}
                            onPress={() => setPreviewIndex(i)}
                            style={[styles.imageCarousel, { height: getImageHeight(img) }]}
                          >
                            <Image
                              source={{ uri: resolveImageUri(img.localUri) }}
                              style={{
                                width: CARD_WIDTH,
                                height: getImageHeight(img),
                              }}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>

                          {/* Content card - only on active slide */}
                          {isActive && (
                              <View
                              style={[styles.contentCard]}
                              onTouchStart={contentTouchStart}
                              onTouchEnd={contentTouchEnd}
                            >
                              <TextInput
                                style={styles.ncImageTitle}
                                value={editableTitle}
                                onChangeText={onTitleChange}
                                placeholder="标题"
                                placeholderTextColor="#C4C4C4"
                                multiline
                              />

                              <ScrollView style={styles.ncScrollBody} nestedScrollEnabled>
                                {img.status === "processing" ? (
                                  <View style={styles.ocrLoadingBox}>
                                    <ActivityIndicator size="small" color="#18181B" />
                                    <Text style={styles.ocrLoadingText}>正在识别文字...</Text>
                                  </View>
                                ) : (
                                  <View style={styles.ncOcrSection}>
                                    <TextInput
                                      style={styles.ncOcrText}
                                      value={editableOcr}
                                      onChangeText={onOcrChange}
                                      placeholder="识别结果"
                                      placeholderTextColor="#C4C4C4"
                                      multiline
                                      textAlignVertical="top"
                                    />
                                    <TouchableOpacity
                                      style={styles.ncOcrRetry}
                                      onPress={async () => {
                                        try {
                                          await api.reanalyzeImage(img.id);
                                          const data = await api.listImages(projectId, noteId);
                                          setImages(data);
                                        } catch (e: any) {
                                          Alert.alert("重新识别失败", e.message || "请重试");
                                        }
                                      }}
                                    >
                                      <IconPark name="refresh" size={12} color="#52525B" />
                                      <Text style={styles.ncOcrRetryText}>重新识别</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </ScrollView>

                              <View style={styles.ncTagsRow}>
                                {noteTags.length === 0 ? (
                                  <Text style={styles.ncBadgePlaceholder}>No tags</Text>
                                ) : (
                                  noteTags.map((tag, ti) => {
                                    const c = getTagColors(tag);
                                    return (
                                      <View key={`${tag}-${ti}`} style={[styles.ncBadgeElement, { backgroundColor: c.bg }]}>
                                        <Text style={[styles.ncBadgeText, { color: c.text }]}>{tag}</Text>
                                        <TouchableOpacity
                                          onPress={() => removeTag(tag)}
                                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                        >
                                          <Text style={[styles.ncBadgeRemoveText, { color: c.text }]}>×</Text>
                                        </TouchableOpacity>
                                      </View>
                                    );
                                  })
                                )}
                                <TouchableOpacity style={styles.ncAddTagBtn} onPress={() => { setTagInputValue(""); setTagInputVisible(true); }}>
                                  <Text style={styles.ncAddTagBtnText}>+</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                <View style={[styles.emptyImageContainer, { height: CARD_HEIGHT }]}>
                  <IconPark name="camera" size={40} color="#A1A1AA" />
                  <Text style={styles.emptyImageText}>暂无截图</Text>
                  <Text style={styles.emptyImageHint}>导入截图后会在这里展示</Text>
                </View>
              )}

              {/* Content Card moved inside slidesTrack */}

              {/* Dots Indicator - inside mainCard, below slides */}
              {totalImages > 1 && (
                <View style={styles.dotsContainer}>
                  {images.map((_, index) => (
                    <TouchableOpacity key={index} onPress={() => { setCurrentIndex(index); scrollToSlide(index); }} activeOpacity={0.7}>
                      <View style={[styles.dot, index === currentIndex && styles.dotActive]} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Badge on wrapper - matches HTML .note-detail-wrapper > .card-badge */}
              {totalImages > 0 && (
                <View style={styles.fixedBadge} pointerEvents="none">
                  <Text style={styles.fixedBadgeText}>{currentIndex + 1}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Image Preview Gallery */}
        <Modal visible={previewIndex !== null} transparent animationType="fade" onRequestClose={() => setPreviewIndex(null)}>
          <TouchableOpacity
            style={styles.previewBg}
            activeOpacity={1}
            onPress={() => setPreviewIndex(null)}
          >
            {previewIndex !== null && (
              <Image
                source={{ uri: resolveImageUri(images[previewIndex].localUri) }}
                style={[styles.previewImage, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}
                resizeMode="contain"
              />
            )}
          </TouchableOpacity>
        </Modal>

        {/* Save Bottom Sheet */}
        {saveModalVisible && (
          <View style={StyleSheet.absoluteFill}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeSaveModal} />
            <View style={{ flex: 1, justifyContent: "flex-end" }}>
              <Animated.View style={[styles.sheetCard, { paddingBottom: insets.bottom + 20, marginBottom: keyboardHeight, transform: [{ translateY: sheetAnim }] }]}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>保存笔记到</Text>

                <View style={styles.saveSection}>
                  <View style={styles.saveSectionHeader}>
                    <Text style={styles.saveLabel}>选择项目</Text>
                    {!showNewProjectInput && (
                      <TouchableOpacity onPress={() => setShowNewProjectInput(true)}>
                        <Text style={styles.saveNewProjectLink}>+ 新建项目</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {showNewProjectInput ? (
                    <View style={styles.newProjectInputRow}>
                      <TextInput
                        style={styles.newProjectInput}
                        value={newProjectName}
                        onChangeText={setNewProjectName}
                        placeholder="输入项目名称"
                        placeholderTextColor="#D4D4D8"
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={handleCreateProjectInSave}
                      />
                      <TouchableOpacity
                        style={[styles.newProjectCreateBtn, (!newProjectName.trim() || creatingProject) && { opacity: 0.4 }]}
                        onPress={handleCreateProjectInSave}
                        disabled={!newProjectName.trim() || creatingProject}
                      >
                        <Text style={styles.newProjectCreateText}>{creatingProject ? "..." : "创建"}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : saveProjects.length === 0 ? (
                    <Text style={styles.saveEmpty}>暂无项目，请新建项目</Text>
                  ) : (
                    <View>
                      {saveProjects.map((p) => {
                        const isSelected = p.id === selectedSaveProjectId;
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={[styles.saveProjectItem, isSelected && styles.saveProjectItemSelected]}
                            onPress={() => setSelectedSaveProjectId(p.id)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.saveProjectItemIcon, isSelected && styles.saveProjectItemIconSelected]}>
                              <IconPark
                                name="folderSm"
                                size={16}
                                color={isSelected ? "#FFFFFF" : "#52525B"}
                              />
                            </View>
                            <Text style={styles.saveProjectItemTitle}>{p.title}</Text>
                            {isSelected && (
                              <Text style={styles.saveProjectItemCheck}>✓</Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={styles.saveSection}>
                  <Text style={styles.saveLabel}>添加标签</Text>
                  <View style={styles.saveTags}>
                    {noteTags.map((t) => {
                      const c = getTagColors(t);
                      return (
                        <View key={t} style={[styles.stag, { backgroundColor: c.bg }]}>
                          <Text style={{ color: c.text, fontSize: 13, fontWeight: "500" }}>{t}</Text>
                          <TouchableOpacity onPress={() => removeTag(t)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                            <Text style={{ color: c.text, marginLeft: 4, fontSize: 14, fontWeight: "600" }}>×</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                  <TextInput
                    style={styles.saveTagInput}
                    value={tagInputValue}
                    onChangeText={setTagInputValue}
                    placeholder="输入标签后回车"
                    placeholderTextColor="#D4D4D8"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      const t = tagInputValue.trim();
                      if (t && !noteTags.includes(t)) setNoteTags([...noteTags, t]);
                      setTagInputValue("");
                    }}
                  />
                </View>

                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.sheetCancelBtn} onPress={closeSaveModal}>
                    <Text style={styles.sheetCancelText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetConfirmBtn, (!selectedSaveProjectId || saving) && { opacity: 0.4 }]}
                    onPress={confirmSave}
                    disabled={!selectedSaveProjectId || saving}
                  >
                    <Text style={styles.sheetConfirmText}>{saving ? "保存中..." : "确定保存"}</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          </View>
        )}

        {/* Tag Input Bottom Sheet */}
        <Modal visible={tagInputVisible} transparent animationType="none" onRequestClose={() => setTagInputVisible(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setTagInputVisible(false)} />
            <View style={styles.sheetKAV} pointerEvents="box-none">
              <Animated.View style={[styles.sheetCard, { paddingBottom: insets.bottom + 20, marginBottom: keyboardHeight, transform: [{ translateY: tagSheetAnim }] }]}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>添加标签</Text>
                <TextInput
                  style={[styles.tagInput, tagInputFocused && { borderColor: "#18181B", backgroundColor: "#FFF" }]}
                  value={tagInputValue}
                  onChangeText={setTagInputValue}
                  placeholder="输入标签名称"
                  placeholderTextColor="#A1A1AA"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={addTag}
                  onFocus={() => setTagInputFocused(true)}
                  onBlur={() => setTagInputFocused(false)}
                />
                <View style={styles.tagSheetActions}>
                  <TouchableOpacity style={styles.tagSheetCancel} onPress={() => setTagInputVisible(false)}>
                    <Text style={styles.tagSheetCancelText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.tagSheetConfirm} onPress={addTag}>
                    <Text style={styles.tagSheetConfirmText}>确定</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          </View>
        </Modal>

        {/* Share Bottom Sheet */}
        <Modal visible={shareModalVisible} transparent animationType="none" onRequestClose={() => setShareModalVisible(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShareModalVisible(false)} />
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.sheetKAV}
              pointerEvents="box-none"
            >
              <Animated.View style={[styles.sheetCard, { paddingBottom: insets.bottom + 20, transform: [{ translateY: shareSheetAnim }] }]}>
                <View style={styles.sheetHandle} />
                <Text style={[styles.sheetTitle, { textAlign: "center" }]}>分享笔记</Text>
                <TouchableOpacity style={styles.shareOption} onPress={() => handleShareOption("text")}>
                  <View style={styles.shareOptionIcon}>
                    <IconPark name="document" size={20} color="#18181B" />
                  </View>
                  <View style={styles.shareOptionContent}>
                    <Text style={styles.shareOptionTitle}>纯文字</Text>
                    <Text style={styles.shareOptionDesc}>复制文字内容到剪贴板</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareOption} onPress={() => handleShareOption("image")}>
                  <View style={styles.shareOptionIcon}>
                    <IconPark name="image" size={20} color="#18181B" />
                  </View>
                  <View style={styles.shareOptionContent}>
                    <Text style={styles.shareOptionTitle}>图片</Text>
                    <Text style={styles.shareOptionDesc}>保存为图片到相册</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareOption} onPress={() => handleShareOption("pdf")}>
                  <View style={styles.shareOptionIcon}>
                    <IconPark name="file" size={20} color="#18181B" />
                  </View>
                  <View style={styles.shareOptionContent}>
                    <Text style={styles.shareOptionTitle}>PDF</Text>
                    <Text style={styles.shareOptionDesc}>导出为PDF文件</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareOption} onPress={() => handleShareOption("link")}>
                  <View style={styles.shareOptionIcon}>
                    <IconPark name="link" size={20} color="#18181B" />
                  </View>
                  <View style={styles.shareOptionContent}>
                    <Text style={styles.shareOptionTitle}>链接</Text>
                    <Text style={styles.shareOptionDesc}>复制分享链接</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareSheetCancel} onPress={() => setShareModalVisible(false)}>
                  <Text style={styles.shareSheetCancelText}>取消</Text>
                </TouchableOpacity>
              </Animated.View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* Image Preview for Share */}
        <Modal visible={!!previewShareImage} transparent animationType="fade">
          <View style={styles.imagePreviewBg}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPreviewShareImage(null)} />
            <View style={styles.imagePreviewContainer}>
              {previewShareImage && (
                <Image source={{ uri: previewShareImage }} style={styles.imagePreview} resizeMode="contain" />
              )}
            </View>
            <View style={styles.imagePreviewActions}>
              <TouchableOpacity
                style={[styles.imagePreviewBtn, styles.imagePreviewBtnSecondary]}
                onPress={() => setPreviewShareImage(null)}
              >
                <Text style={[styles.imagePreviewBtnText, styles.imagePreviewBtnTextSecondary]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imagePreviewBtn, styles.imagePreviewBtnPrimary]}
                onPress={confirmSaveImage}
              >
                <Text style={[styles.imagePreviewBtnText, styles.imagePreviewBtnTextPrimary]}>保存到相册</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* PDF Preview */}
        <Modal visible={showPdfPreview} transparent animationType="slide">
          <View style={styles.pdfPreviewBg}>
            <View style={[styles.pdfPreviewHeader, { paddingTop: insets.top + 16 }]}>
              <TouchableOpacity onPress={() => setShowPdfPreview(false)}>
                <Text style={styles.pdfPreviewClose}>关闭</Text>
              </TouchableOpacity>
              <Text style={styles.pdfPreviewTitle}>PDF预览</Text>
              <TouchableOpacity onPress={handleSavePdf}>
                <Text style={styles.pdfPreviewSave}>保存</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pdfPreviewContent}>
              {pdfUri && (
                <Pdf
                  source={{ uri: pdfUri, cache: true }}
                  style={styles.pdfView}
                  onLoadComplete={(numberOfPages) => console.log(`PDF加载完成，共${numberOfPages}页`)}
                />
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#E5E5E5" },

  /* Top Bar */
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#ECECEE",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 4,
  },
  backBtnText: { fontSize: 16, color: "#18181B", fontWeight: "500", marginLeft: 4 },
  unsavedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444", marginLeft: 6 },
  topBarActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  saveBtn: {
    backgroundColor: "#18181B",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  saveBtnText: { color: "#FFF", fontSize: 12, fontWeight: "600" },
  shareIconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  captureArea: { padding: 16 },
  mainCard: {
    marginBottom: 16,
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    padding: 8,
    position: "relative",
    overflow: "hidden",
  },

  slidesTrack: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
  },

  noteSlide: {
    width: SCREEN_WIDTH - (CAPTURE_PADDING + WRAPPER_PADDING) * 2,
    flexShrink: 0,
    flexDirection: "column",
  },

  imageCarousel: {
    width: CARD_WIDTH,
    backgroundColor: "#E5E5E5",
    overflow: "hidden",
    position: "relative",
  },
  slideImage: { width: "100%", height: "100%" },
  fixedBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fixedBadgeText: { fontSize: 12, fontWeight: "700", color: "#18181B" },

  emptyImageContainer: {
    width: CARD_WIDTH,
    backgroundColor: "#E5E5E5",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyImageText: { fontSize: 16, fontWeight: "500", color: "#71717A", marginTop: 12 },
  emptyImageHint: { fontSize: 13, color: "#A1A1AA", marginTop: 6 },

  contentCard: {
    flex: 1,
    backgroundColor: "transparent",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 16,
  },

  ncImageTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 22,
    fontWeight: "700",
    color: "#18181B",
    marginBottom: 6,
    lineHeight: 26,
    paddingVertical: 0,
  },

  ocrLoadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    backgroundColor: "rgba(243,243,249,0.6)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(227,226,229,0.6)",
  },
  ocrLoadingText: { fontSize: 14, color: "#A1A1AA" },

  ncScrollBody: {
    flex: 1,
  },
  ncOcrSection: {
    flex: 1,
  },
  ncOcrText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#52525B",
  },
  ncOcrRetry: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    backgroundColor: "#FFFFFF",
    gap: 4,
  },
  ncOcrRetryText: { fontSize: 13, fontWeight: "500", color: "#52525B", marginLeft: 2 },

  ncTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    alignItems: "center",
    marginTop: 10,
  },
  ncBadgeElement: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 6,
    gap: 6,
  },
  ncBadgeText: { fontSize: 13, fontWeight: "600" },
  ncBadgeRemoveText: { fontSize: 16, fontWeight: "600", opacity: 0.6, marginLeft: 2 },
  ncBadgePlaceholder: { fontSize: 13, fontWeight: "500", color: "#A1A1AA" },
  ncAddTagBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
  },
  ncAddTagBtnText: { fontSize: 15, fontWeight: "500", color: "#52525B" },

  dotsContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingTop: 10, paddingBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#A1A1AA" },
  dotActive: { width: 20, backgroundColor: "#18181B" },

  /* Image Preview Modal */
  previewBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  previewImage: {},

  /* Bottom Sheet */
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheetKAV: { width: "100%", justifyContent: "flex-end" },
  sheetCard: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 34,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D4D4D8",
    alignSelf: "center",
    marginTop: 10,
  },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: "#18181B", paddingTop: 18, paddingBottom: 14 },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  sheetCancelBtn: { flex: 1, borderWidth: 1.5, borderColor: "#ECECEE", borderRadius: 10, paddingVertical: 13, alignItems: "center", backgroundColor: "#FFF" },
  sheetCancelText: { fontSize: 15, fontWeight: "600", color: "#52525B" },
  sheetConfirmBtn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center", backgroundColor: "#18181B" },
  sheetConfirmText: { fontSize: 15, fontWeight: "600", color: "#FFF" },

  /* Save Sheet */
  saveSection: { marginBottom: 16 },
  saveSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  saveLabel: { fontSize: 12, fontWeight: "600", color: "#A1A1AA", letterSpacing: 1, textTransform: "uppercase" },
  saveNewProject: { fontSize: 14, fontWeight: "500", color: "#18181B" },
  saveNewProjectLink: { fontSize: 12, fontWeight: "600", color: "#18181B" },
  saveEmpty: { paddingVertical: 16, fontSize: 13, color: "#A1A1AA", textAlign: "center" },
  newProjectInputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  newProjectInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#ECECEE",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#18181B",
    backgroundColor: "#FAFAFA",
  },
  newProjectCreateBtn: {
    backgroundColor: "#18181B",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
  },
  newProjectCreateText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  saveProjectItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  saveProjectItemSelected: { backgroundColor: "#EEF0FF" },
  saveProjectItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
  },
  saveProjectItemIconSelected: { backgroundColor: "#18181B" },
  saveProjectItemTitle: { flex: 1, fontSize: 14, fontWeight: "500", color: "#18181B" },
  saveProjectItemCheck: { marginLeft: "auto", color: "#18181B", fontWeight: "600" },
  saveTags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  stag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveTagInput: {
    borderWidth: 1,
    borderColor: "rgba(227,226,229,0.6)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#18181B",
    backgroundColor: "rgba(243,243,249,0.6)",
  },
  tagInput: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#18181B",
    backgroundColor: "#F4F4F5",
  },
  tagSheetActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  tagSheetCancel: {
    flex: 1,
    backgroundColor: "#F4F4F5",
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: "center",
  },
  tagSheetCancelText: { fontSize: 15, fontWeight: "600", color: "#52525B" },
  tagSheetConfirm: {
    flex: 1,
    backgroundColor: "#18181B",
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: "center",
  },
  tagSheetConfirmText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },

  /* Share */
  shareOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    marginBottom: 10,
  },
  shareOptionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", marginRight: 14 },
  shareOptionContent: { flex: 1 },
  shareOptionTitle: { fontSize: 15, fontWeight: "600", color: "#18181B", marginBottom: 2 },
  shareOptionDesc: { fontSize: 13, color: "#71717A" },
  shareSheetCancel: { marginTop: 8, paddingVertical: 14, alignItems: "center", backgroundColor: "#F4F4F5", borderRadius: 12 },
  shareSheetCancelText: { fontSize: 15, fontWeight: "600", color: "#52525B" },

  /* Image Preview for Share */
  imagePreviewBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  imagePreviewContainer: { width: "90%", height: "70%", borderRadius: 12, overflow: "hidden" },
  imagePreview: { width: "100%", height: "100%" },
  imagePreviewActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  imagePreviewBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100 },
  imagePreviewBtnPrimary: { backgroundColor: "#FFFFFF" },
  imagePreviewBtnSecondary: { backgroundColor: "rgba(255,255,255,0.2)" },
  imagePreviewBtnText: { fontSize: 15, fontWeight: "600" },
  imagePreviewBtnTextPrimary: { color: "#18181B" },
  imagePreviewBtnTextSecondary: { color: "#FFFFFF" },

  /* PDF Preview */
  pdfPreviewBg: { flex: 1, backgroundColor: "#FFFFFF" },
  pdfPreviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#ECECEE" },
  pdfPreviewClose: { fontSize: 15, color: "#52525B", fontWeight: "500" },
  pdfPreviewTitle: { fontSize: 17, fontWeight: "600", color: "#18181B" },
  pdfPreviewSave: { fontSize: 15, color: "#18181B", fontWeight: "600" },
  pdfPreviewContent: { flex: 1 },
  pdfView: { flex: 1, backgroundColor: "#F5F5F5" },
});
