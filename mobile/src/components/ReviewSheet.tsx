import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { OwnReview, ReviewOptions } from '@/lib/types';
import { colors, fonts, radius } from '@/theme';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { Button, Field, Sheet, T, tap } from './ui';

/** What is being reviewed: a kit, or a workshop session the child attended. */
export type ReviewTarget =
  | { kind?: 'product'; id: number; name: string; image: string | null }
  | { kind: 'workshop'; id: string; name: string; image: string | null; when?: string };

const RATING_LABELS: Record<number, string> = { 1: 'Rất tệ', 2: 'Chưa hài lòng', 3: 'Bình thường', 4: 'Hài lòng', 5: 'Tuyệt vời' };
const FALLBACK: ReviewOptions = { labels: RATING_LABELS, tags: { good: [], bad: [] }, maxImages: 4, maxLength: 1000 };

const COPY = {
  product: {
    title: 'Đánh giá sản phẩm',
    noStars: 'Chọn số sao cho sản phẩm.',
    placeholder: 'Bé thích điều gì nhất? Hạt nảy mầm sau mấy ngày? Hộp kit có đủ đồ không?',
    note: 'Đánh giá hiển thị công khai trên trang sản phẩm, kèm nhãn “Đã mua hàng”.',
    gone: 'Đánh giá sẽ biến mất khỏi trang sản phẩm.',
    photoHint: '',
  },
  workshop: {
    title: 'Đánh giá buổi workshop',
    noStars: 'Chọn số sao cho buổi học.',
    placeholder: 'Bé thích hoạt động nào nhất? Hướng dẫn viên thế nào?',
    note: 'Đánh giá hiển thị công khai trên trang Workshop, kèm nhãn “Đã tham gia”.',
    gone: 'Đánh giá sẽ biến mất khỏi trang Workshop.',
    // Children are in these photos; a parent should choose that knowingly.
    photoHint: 'Ảnh hiển thị công khai — nên chọn ảnh không thấy rõ mặt bé.',
  },
};

/** The same masking the server uses, to preview "Hiển thị là …". */
function maskedName(full: string, anonymous: boolean) {
  if (anonymous) return 'Khách hàng Sprouty';
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Khách hàng Sprouty';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(1).join(' ')} ${parts[0].charAt(0).toUpperCase()}.`;
}

type Payload = { rating: number; content: string; tags: string[]; images: string[]; anonymous: boolean };

function saver(target: ReviewTarget) {
  if (target.kind === 'workshop') {
    return {
      create: (p: Payload) => API.workshopReviews.create({ workshopId: target.id, ...p }),
      update: (id: string, p: Payload) => API.workshopReviews.update(id, p),
      remove: (id: string) => API.workshopReviews.remove(id),
    };
  }
  return {
    create: (p: Payload) => API.reviews.create({ productId: target.id, ...p }),
    update: (id: string, p: Payload) => API.reviews.update(id, p),
    remove: (id: string) => API.reviews.remove(id),
  };
}

/**
 * Writing or changing a review. Stars first — the one thing asked — then quick
 * remarks that change with the stars, a few words, up to four photos, and
 * whether to sign with one's name. Same rules as the website's ReviewDialog.
 */
export function ReviewSheet({ target, existing, options, onClose, onSaved }: {
  target: ReviewTarget | null; existing?: OwnReview | null; options?: ReviewOptions | null;
  onClose: () => void; onSaved: (review: OwnReview | null) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const opts = options || FALLBACK;
  const copy = COPY[target?.kind || 'product'];
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!target) return;
    setRating(existing?.rating || 0);
    setTags(existing?.tags || []);
    setContent(existing?.content || '');
    setImages(existing?.images || []);
    setAnonymous(Boolean(existing?.anonymous));
    setError('');
    setBusy(false);
  }, [target, existing]);

  const offered = useMemo(() => {
    if (!rating) return [];
    if (rating >= 4) return opts.tags.good;
    if (rating <= 2) return opts.tags.bad;
    return [...opts.tags.good, ...opts.tags.bad];
  }, [rating, opts.tags]);

  async function addPhotos() {
    const room = opts.maxImages - images.length - uploading;
    if (room <= 0) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.8 });
    if (picked.canceled) return;
    setError('');
    for (const asset of picked.assets.slice(0, room)) {
      setUploading((n) => n + 1);
      try {
        const form = new FormData();
        form.append('file', { uri: asset.uri, name: asset.fileName || 'review.jpg', type: asset.mimeType || 'image/jpeg' } as never);
        const { url } = await API.reviews.uploadImage(form);
        setImages((list) => [...list, url]);
      } catch (err: any) {
        setError(err?.message || 'Không tải được ảnh lên.');
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function submit() {
    if (!target) return;
    if (!rating) return setError(copy.noStars);
    setBusy(true);
    setError('');
    const payload = { rating, content: content.trim(), tags: tags.filter((t) => offered.includes(t)), images, anonymous };
    try {
      const api = saver(target);
      const data = existing ? await api.update(existing.id, payload) : await api.create(payload);
      toast(data.message || 'Cảm ơn bạn đã đánh giá!', 'success');
      onSaved(data.review);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Chưa gửi được đánh giá. Vui lòng thử lại.');
      setBusy(false);
    }
  }

  function remove() {
    if (!existing || !target) return;
    Alert.alert('Xoá đánh giá', `Xoá đánh giá này? ${copy.gone}`, [
      { text: 'Không', style: 'cancel' },
      { text: 'Xoá đánh giá', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          const data = await saver(target).remove(existing.id);
          toast(data.message || 'Đã xoá đánh giá.', 'success');
          onSaved(null);
          onClose();
        } catch (err: any) {
          setError(err?.message || 'Không xoá được đánh giá.');
          setBusy(false);
        }
      } },
    ]);
  }

  return (
    <Sheet open={Boolean(target)} title={existing ? 'Sửa đánh giá' : copy.title} onClose={() => !busy && onClose()}
      footer={(
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {existing && <Button variant="ghost" title="Xoá" onPress={remove} disabled={busy} />}
          <Button grow title={busy ? 'Đang gửi…' : existing ? 'Lưu thay đổi' : 'Gửi đánh giá'} busy={busy} disabled={uploading > 0 || !rating} onPress={submit} />
        </View>
      )}>
      {target && (
        <View style={s.head}>
          <View style={s.thumb}>
            {imageSource(target.image) ? <Image source={imageSource(target.image)} style={StyleSheet.absoluteFill} contentFit="cover" />
              : <Icon name={target.kind === 'workshop' ? 'ticket' : 'pot'} size={22} color={colors.greenDark} />}
          </View>
          <View style={{ flex: 1 }}>
            <T bold numberOfLines={2}>{target.name}</T>
            {target.kind === 'workshop' && target.when ? <T muted>{target.when}</T> : null}
          </View>
        </View>
      )}
      {existing?.status === 'hidden' && (
        <T style={{ color: colors.warn }}>Đánh giá này đang bị ẩn{existing.hiddenReason ? `: ${existing.hiddenReason}` : ''}. Bạn vẫn sửa được.</T>
      )}

      <View style={{ alignItems: 'center', gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => { tap(); setRating(n); setError(''); }} style={s.star} accessibilityRole="button" accessibilityLabel={`${n} sao`}>
              <Text style={{ fontSize: 36, color: rating >= n ? '#F4A51C' : '#E2E6DC' }}>★</Text>
            </Pressable>
          ))}
        </View>
        <T bold style={{ color: rating ? colors.ink : colors.ink4 }}>{rating ? opts.labels[String(rating)] || RATING_LABELS[rating] : 'Chạm để chọn số sao'}</T>
      </View>

      {offered.length > 0 && (
        <View style={{ gap: 8 }}>
          <T bold>{rating >= 4 ? 'Điều bạn thích' : rating <= 2 ? 'Điều chưa ổn' : 'Nhận xét nhanh'}</T>
          <View style={s.tags}>
            {offered.map((tag) => {
              const on = tags.includes(tag);
              return (
                <Pressable key={tag} onPress={() => { tap(); setTags((list) => (on ? list.filter((t) => t !== tag) : [...list, tag])); }}
                  style={[s.tag, on && s.tagOn]} accessibilityState={{ selected: on }}>
                  {on && <Icon name="check" size={14} color={colors.greenDark} />}
                  <Text style={[s.tagText, on && { color: colors.greenDark }]}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Field label="Chia sẻ thêm (không bắt buộc)" value={content} onChangeText={setContent} multiline maxLength={opts.maxLength}
        placeholder={copy.placeholder} hint={`${content.length}/${opts.maxLength}`} />

      <View style={{ gap: 8 }}>
        <T bold>Ảnh thực tế (tối đa {opts.maxImages})</T>
        {copy.photoHint ? <T muted style={{ fontSize: 13 }}>{copy.photoHint}</T> : null}
        <View style={s.photos}>
          {images.map((url) => (
            <View key={url} style={s.photo}>
              <Image source={imageSource(url)} style={StyleSheet.absoluteFill} contentFit="cover" />
              <Pressable style={s.photoX} onPress={() => setImages((list) => list.filter((u) => u !== url))} accessibilityLabel="Bỏ ảnh này" hitSlop={8}>
                <Icon name="close" size={12} color={colors.white} />
              </Pressable>
            </View>
          ))}
          {Array.from({ length: uploading }, (_, i) => <View key={`up-${i}`} style={[s.photo, s.photoAdd]}><T muted>…</T></View>)}
          {images.length + uploading < opts.maxImages && (
            <Pressable style={[s.photo, s.photoAdd]} onPress={addPhotos} accessibilityRole="button" accessibilityLabel="Thêm ảnh">
              <Icon name="camera" size={22} color={colors.green} />
              <Text style={s.addText}>Thêm ảnh</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={s.anon}>
        <View style={{ flex: 1 }}>
          <T bold>Ẩn tên của tôi</T>
          <T muted>Hiển thị là: {maskedName(user?.name || '', anonymous)}</T>
        </View>
        <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ true: colors.green, false: colors.ink5 }} thumbColor={colors.white} />
      </View>
      {error ? <T style={{ color: colors.bad }}>{error}</T> : null}
      <T muted style={{ fontSize: 13 }}>{copy.note}</T>
    </Sheet>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  star: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  tagText: { fontFamily: fonts.semi, fontSize: 13.5, color: colors.ink2 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: 76, height: 76, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.greenSoft },
  photoAdd: { alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CFE9C9', backgroundColor: colors.card },
  photoX: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(32,52,36,0.7)', alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: fonts.semi, fontSize: 12, color: colors.green },
  anon: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
});
