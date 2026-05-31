import { useCallback, useState } from "react";
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
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "../services/api";
import IconPark from "../components/IconPark";

interface Project {
  id: number;
  title: string;
  createdAt: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

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

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.importBtn}
          onPress={() => {
            if (projects.length === 0) {
              Alert.alert("提示", "请先创建一个项目");
              return;
            }
            router.push(`/project/${projects[0].id}`);
          }}
        >
          <IconPark name="camera" size={26} color="#FFF" />
          <View>
            <Text style={styles.importLabel}>从相册导入截图</Text>
            <Text style={styles.importHint}>支持多选，最多 20 张</Text>
          </View>
          <View style={{ marginLeft: "auto" }}>
            <IconPark name="arrowRight" size={20} color="rgba(255,255,255,0.5)" />
          </View>
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
  hero: { paddingTop: 20, paddingHorizontal: 20, marginBottom: 24 },
  badge: {
    fontSize: 10,
    fontWeight: "600",
    color: "#18181B",
    letterSpacing: 4,
    marginBottom: 10,
  },
  title: { fontSize: 34, fontWeight: "700", color: "#18181B" },
  subtitle: { fontSize: 14, color: "#A1A1AA", marginTop: 8, lineHeight: 22 },
  quickActions: { paddingHorizontal: 16, marginBottom: 28 },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181B",
    borderRadius: 100,
    padding: 16,
    gap: 14,
    shadowColor: "#18181B",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  importLabel: { color: "#FFF", fontWeight: "600", fontSize: 15, letterSpacing: 0.5 },
  importHint: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },

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
