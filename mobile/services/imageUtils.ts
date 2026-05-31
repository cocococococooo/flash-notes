import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  MAX_IMAGES_PER_BATCH,
  IMAGE_COMPRESS_MAX_WIDTH,
  IMAGE_COMPRESS_MAX_HEIGHT,
  IMAGE_COMPRESS_QUALITY,
} from "../constants/config";

export async function pickImages(): Promise<string[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("需要相册访问权限来导入截图");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: MAX_IMAGES_PER_BATCH,
    quality: 1,
  });

  if (result.canceled) return [];

  const compressedUris: string[] = [];
  for (const asset of result.assets) {
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: IMAGE_COMPRESS_MAX_WIDTH, height: IMAGE_COMPRESS_MAX_HEIGHT } }],
      { compress: IMAGE_COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );
    compressedUris.push(compressed.uri);
  }

  return compressedUris;
}
