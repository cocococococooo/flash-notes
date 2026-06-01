import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import IconPark from "../components/IconPark";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const iconName: Record<string, string> = {
    "首页": "home",
    "笔记": "notes",
  };
  return (
    <View style={{ alignItems: "center", gap: 1 }}>
      <IconPark name={iconName[label] || "home"} size={22} color={focused ? "#18181B" : "#A1A1AA"} />
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? "600" : "500",
          color: focused ? "#18181B" : "#A1A1AA",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// Top navigation removed — restored to simple Tabs layout per request.

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#FFF",
            borderTopColor: "#F0F0EE",
            borderTopWidth: 1,
            height: 90,
            paddingTop: 8,
            paddingBottom: 34,
          },
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="首页" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="notes"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="笔记" focused={focused} />,
          }}
        />
      </Tabs>
    </>
  );
}
