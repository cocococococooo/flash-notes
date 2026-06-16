import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform, Alert } from "react-native";
import {
  MAX_IMAGES_PER_BATCH,
  IMAGE_COMPRESS_MAX_WIDTH,
  IMAGE_COMPRESS_MAX_HEIGHT,
  IMAGE_COMPRESS_QUALITY,
} from "../constants/config";

export async function pickImages(): Promise<string[]> {
  // Request permission with proper handling for Android 13+
  const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permissionResult.status !== "granted") {
    if (permissionResult.canAskAgain) {
      Alert.alert(
        "需要相册权限",
        "闪记需要访问相册来导入截图，请在设置中开启权限",
        [{ text: "去设置", onPress: () => ImagePicker.requestMediaLibraryPermissionsAsync() }, { text: "取消" }]
      );
    }
    throw new Error("需要相册访问权限来导入截图");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: Platform.OS === "ios" ? ["images"] : ["images"],
    allowsMultipleSelection: true,
    selectionLimit: MAX_IMAGES_PER_BATCH,
    quality: 1,
    presentationStyle: "fullScreen",
  });

  if (result.canceled) return [];

  const compressedUris: string[] = [];
  for (const asset of result.assets) {
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [],
      { compress: IMAGE_COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );
    compressedUris.push(compressed.uri);
  }

  return compressedUris;
}
