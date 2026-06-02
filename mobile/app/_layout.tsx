import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="note/[id]"
        options={{ animation: "default" }}
      />
      <Stack.Screen
        name="project/[id]"
        options={{ animation: "default" }}
      />
    </Stack>
  );
}
