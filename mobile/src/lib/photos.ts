import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/*
 * Photos and clips from the phone: picked from the library or taken there and
 * then, and turned into what the API takes — a multipart file for an upload,
 * or a small JPEG data URL for Sprouty AI to look at.
 */

export type Picked = ImagePicker.ImagePickerAsset;

/** The library, or the camera. Null when the parent backs out or says no. */
export async function pickMedia(from: 'library' | 'camera', opts: { videos?: boolean; multiple?: number } = {}): Promise<Picked[] | null> {
  const mediaTypes: ImagePicker.MediaType[] = opts.videos ? ['images', 'videos'] : ['images'];
  if (from === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Sprouty cần quyền dùng máy ảnh. Bạn bật lại trong Cài đặt của điện thoại nhé.');
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes, quality: 0.85, videoMaxDuration: 60 });
    return shot.canceled ? null : shot.assets;
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    quality: 0.85,
    allowsMultipleSelection: Boolean(opts.multiple && opts.multiple > 1),
    selectionLimit: opts.multiple || 1,
  });
  return picked.canceled ? null : picked.assets;
}

export const isVideoAsset = (asset: Picked) => asset.type === 'video' || (asset.mimeType || '').startsWith('video/');

/** A picked file as a multipart part. React Native's FormData takes {uri, name, type}. */
export function filePart(asset: Picked) {
  const video = isVideoAsset(asset);
  const type = asset.mimeType || (video ? 'video/mp4' : 'image/jpeg');
  const ext = type.split('/')[1]?.replace('quicktime', 'mov').replace('jpeg', 'jpg') || (video ? 'mp4' : 'jpg');
  return { uri: asset.uri, name: asset.fileName || `sprouty-${Date.now()}.${ext}`, type } as never;
}

/**
 * A photo scaled down to `maxDim` on its long side, as a JPEG data URL. A
 * caption or a plant check does not need full resolution, and the chat API
 * caps the picture at under 3 MB.
 */
export async function toDataUrl(asset: Pick<Picked, 'uri' | 'width' | 'height'>, maxDim = 640, compress = 0.72) {
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width >= asset.height && asset.width > maxDim) context.resize({ width: maxDim });
  else if (asset.height > maxDim) context.resize({ height: maxDim });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ base64: true, compress, format: SaveFormat.JPEG });
  return `data:image/jpeg;base64,${saved.base64}`;
}
