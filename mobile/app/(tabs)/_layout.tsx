import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import IconPark from "../../components/IconPark";

const TAB_DEFS = [
  { route: "index", label: "首页", getIcon: (f: boolean) => (f ? "homeFilled" : "home") },
  { route: "notes", label: "笔记", getIcon: (f: boolean) => (f ? "folderFilled" : "folder") },
];

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { bottom: insets.bottom + 12 }]}>
      {state.routes.map((route: any, i: number) => {
        const focused = state.index === i;
        const def = TAB_DEFS[i];
        return (
          <Pressable
            key={route.key}
            style={[styles.tabItem, focused && styles.tabItemActive]}
            onPress={() => navigation.navigate(route.name)}
          >
            <IconPark name={def.getIcon(focused)} size={20} color={focused ? "#000" : "rgba(0,0,0,0.35)"} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="notes" />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    backgroundColor: "rgb(247,247,247)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.07)",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 32 },
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  tabItemActive: {
    backgroundColor: "rgb(255,255,255)",
    borderColor: "rgba(0,0,0,0.07)",
  },
});
