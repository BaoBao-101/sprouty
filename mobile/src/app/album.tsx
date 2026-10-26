import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { VideoModal } from '@/components/media';
import { PlantThumb } from '@/components/PlantThumb';
import { useToast } from '@/components/Toast';
import { ActionBar, Button, Card, Chip, cheer, Empty, ErrorNote, Field, H, Loading, Screen, Sheet, T } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { filePart, isVideoAsset, pickMedia, toDataUrl, type Picked } from '@/lib/photos';
import type { Album, AlbumLeaf, PlantCard } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme';

type AlbumData = Album & { plants?: Array<{ id: string; nickname: string }>; status?: string };
type Leaf = AlbumLeaf & { status?: 'active' | 'hidden' };

const isVideo = (leaf: Leaf) => (leaf.asset?.mimeType || '').startsWith('video/');

/** Choosing whose album to open, when the garden's album button is tapped. */
function PlantPicker() {
  const plants = useLoad(async () => (await API.plants.list()).plants as PlantCard[]);
  return (
    <Screen title="Album kỷ niệm" back="/garden" onRefresh={plants.reload}>
      <T muted>Mỗi cây có một album riêng: ảnh và video bé chụp theo từng chặng lớn của cây.</T>
      {plants.loading && <Loading />}
      {plants.error ? <ErrorNote message={plants.error} onRetry={plants.reload} /> : null}
      {plants.data?.length === 0 && (
        <Empty title="Chưa có cây nào" text="Kích hoạt một bộ kit để bắt đầu album đầu tiên của bé.">
          <Button title="Kích hoạt cây" icon="seed" onPress={() => router.replace('/garden?activate=1')} />
        </Empty>
      )}
      {plants.data?.map((p) => (
        <Pressable key={p.id} onPress={() => router.push(`/album?productId=${p.productId}&plantId=${p.id}`)} style={({ pressed }) => [s.pick, pressed && { backgroundColor: colors.greenSoft }]}>
          <View style={[s.pickArt, { backgroundColor: p.bgColor || '#F0FDF4' }]}>
            <PlantThumb plant={p} size={64} />
          </View>
          <View style={{ flex: 1 }}>
            <T bold>{p.nickname}</T>
            <T muted>{p.speciesLabel} · {p.stageLabel}</T>
          </View>
          <Icon name="arrow-right" size={18} color={colors.ink3} />
        </Pressable>
      ))}
    </Screen>
  );
}

/** Adding a leaf: the photo, which stage's branch it goes on, a name (Sprouty AI can suggest one), a diary line. */
function ComposeSheet({ asset, album, counts, onClose, onUploaded, productId, plantId, initialStage }: {
  asset: Picked | null; album: AlbumData; counts: Map<string, number>; onClose: () => void; onUploaded: () => void;
  productId: string; plantId: string; initialStage: string;
}) {
  const toast = useToast();
  const perStage = album.leavesPerStage ?? null;
  const isFull = (id: string) => perStage !== null && (counts.get(id) || 0) >= perStage;
  const [stage, setStage] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);

  // A fresh form for each new photo.
  if (asset && seen !== asset.uri) {
    setSeen(asset.uri);
    setStage(initialStage && !isFull(initialStage) ? initialStage : album.stages.find((st) => !isFull(st.id))?.id || '');
    setTitle('');
    setNote('');
    setBusy(false);
  }
  const video = asset ? isVideoAsset(asset) : false;

  async function suggest() {
    if (!asset || suggesting) return;
    setSuggesting(true);
    try {
      const { reply } = await API.chat.send([{
        role: 'user',
        content: 'Hãy đặt một caption tiếng Việt ngắn gọn (tối đa 8 từ) mô tả đúng những gì có trong ảnh này, dùng làm tên cho khoảnh khắc. Chỉ trả lời đúng một dòng caption, không thêm lời dẫn.',
      }], await toDataUrl(asset));
      setTitle(String(reply || '').replace(/^["'“”]+|["'“”]+$/g, '').trim().slice(0, 120));
    } catch (err: any) {
      toast(err?.message || 'Không tạo được gợi ý.', 'error');
    } finally {
      setSuggesting(false);
    }
  }

  async function submit() {
    if (!asset || !stage) return;
    setBusy(true);
    try {
      const form = new FormData();
      if (title.trim()) form.append('title', title.trim());
      if (note.trim()) form.append('note', note.trim());
      form.append('stage', stage);
      form.append('image', filePart(asset));
      await API.album.upload(productId, form, plantId);
      cheer();
      toast('Đã thêm lá mới lên cây kỷ niệm!', 'success');
      onUploaded();
      onClose();
    } catch (err: any) {
      toast(err?.message || 'Chưa đăng được. Vui lòng thử lại.', 'error');
      setBusy(false);
    }
  }

  return (
    <Sheet open={Boolean(asset)} title="Thêm khoảnh khắc" onClose={() => !busy && onClose()}
      footer={<Button title={busy ? 'Đang đăng…' : 'Đăng lên cây'} icon="sprout" busy={busy} disabled={!stage || suggesting} onPress={submit} />}>
      {asset && (
        <View style={s.preview}>
          {video ? (
            <View style={s.videoPreview}><Icon name="camera" size={34} color={colors.white} /><Text style={s.videoText}>Video đã chọn</Text></View>
          ) : <Image source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
        </View>
      )}
      <View style={{ gap: 8 }}>
        <T bold>Chặng của cây</T>
        <View style={s.stageWrap}>
          {album.stages.map((st) => {
            const full = isFull(st.id);
            const n = counts.get(st.id) || 0;
            const on = stage === st.id;
            return (
              <Pressable key={st.id} disabled={full || busy} onPress={() => setStage(st.id)} style={[s.stage, on && s.stageOn, full && { opacity: 0.45 }]}
                accessibilityRole="radio" accessibilityState={{ checked: on, disabled: full }}>
                <Icon name={st.icon} size={15} color={on ? colors.white : colors.green} />
                <Text style={[s.stageText, on && { color: colors.white }]}>{st.label}{album.plant?.stage === st.id ? ' · hiện tại' : ''}</Text>
                <Text style={[s.stageCount, on && { color: colors.white }]}>{full ? 'Đủ' : perStage !== null ? `${n}/${perStage}` : n || ''}</Text>
              </Pressable>
            );
          })}
        </View>
        <T muted style={{ fontSize: 12.5 }}>{perStage === null ? 'Chặng đã qua vẫn thêm ảnh được.' : `Mỗi chặng tối đa ${perStage} lá. Thành viên VIP không giới hạn.`}</T>
      </View>
      <Field label="Tên khoảnh khắc" value={title} onChangeText={setTitle} maxLength={120} placeholder="VD: Mầm đầu tiên nhú lên" />
      {!video && <Button small variant="soft" icon="sparkle" title={suggesting ? 'Sprouty AI đang xem ảnh…' : 'AI gợi ý tên'} busy={suggesting} onPress={suggest} />}
      <Field label="Nhật ký (không bắt buộc)" value={note} onChangeText={setNote} multiline maxLength={1000} placeholder="Hôm nay bé thấy cây thế nào?" />
    </Sheet>
  );
}

/** Looking at a leaf, editing its name and diary, or taking it off the tree. */
function LeafSheet({ leaf, onClose, onChanged, onPlay }: { leaf: Leaf | null; onClose: () => void; onChanged: () => void; onPlay: (leaf: Leaf) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  if (leaf && seen !== leaf.id) {
    setSeen(leaf.id);
    setTitle(leaf.title || '');
    setNote(leaf.note || '');
    setBusy(false);
  }
  if (!leaf && seen) setSeen(null);
  const dirty = leaf ? title.trim() !== (leaf.title || '') || note.trim() !== (leaf.note || '') : false;

  async function save() {
    if (!leaf) return;
    setBusy(true);
    try {
      await API.album.update(leaf.id, { title: title.trim(), note: note.trim() });
      toast('Đã lưu', 'success');
      onChanged();
      onClose();
    } catch (err: any) {
      toast(err?.message || 'Không lưu được.', 'error');
      setBusy(false);
    }
  }

  function remove() {
    if (!leaf) return;
    Alert.alert('Xoá lá này?', 'Ảnh sẽ không còn trong album của cây.', [
      { text: 'Không', style: 'cancel' },
      { text: 'Xoá lá', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await API.album.remove(leaf.id);
          toast('Đã xoá lá', 'success');
          onChanged();
          onClose();
        } catch (err: any) {
          toast(err?.message || 'Không xoá được.', 'error');
          setBusy(false);
        }
      } },
    ]);
  }

  const hidden = leaf?.status === 'hidden';
  return (
    <Sheet open={Boolean(leaf)} title={leaf?.stageLabel ? `Chặng ${leaf.stageLabel}` : 'Kỷ niệm của cây'} onClose={() => !busy && onClose()}
      footer={(
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant="ghost" icon="trash" title="Xoá" disabled={busy} onPress={remove} />
          <Button grow title={busy ? 'Đang lưu…' : 'Lưu'} disabled={!dirty} busy={busy} onPress={save} />
        </View>
      )}>
      {leaf && (
        hidden ? (
          <Card tone="warn"><T>Nội dung này đã được quản trị viên ẩn. Bạn vẫn sửa được tên, nhật ký hoặc xoá lá khỏi album.</T></Card>
        ) : isVideo(leaf) ? (
          <Pressable style={[s.preview, s.videoPreview]} onPress={() => onPlay(leaf)} accessibilityLabel="Xem video">
            <View style={s.play}><Icon name="arrow-right" size={26} color={colors.white} /></View>
            <Text style={s.videoText}>Bấm để xem video</Text>
          </Pressable>
        ) : (
          <View style={[s.preview, { aspectRatio: 1 }]}><Image source={imageSource(leaf.url)} style={StyleSheet.absoluteFill} contentFit="contain" /></View>
        )
      )}
      {leaf && <T muted>{formatDate(leaf.createdAt)}</T>}
      <Field label="Tên khoảnh khắc" value={title} onChangeText={setTitle} maxLength={120} />
      <Field label="Nhật ký" value={note} onChangeText={setNote} multiline maxLength={1000} placeholder="Hôm nay bé thấy cây thế nào?" />
    </Sheet>
  );
}

/**
 * Album kỷ niệm: a plant's photos and clips, grouped by the stage it was at,
 * newest stage first — the plant's journey rather than a pile of pictures.
 */
export default function AlbumScreen() {
  const params = useLocalSearchParams<{ productId?: string; plantId?: string }>();
  if (!params.productId) return <PlantPicker />;
  return <PlantAlbum productId={String(params.productId)} plantId={String(params.plantId || '')} />;
}

function PlantAlbum({ productId, plantId }: { productId: string; plantId: string }) {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState('all');
  const [composing, setComposing] = useState<Picked | null>(null);
  const [viewing, setViewing] = useState<Leaf | null>(null);
  const [playing, setPlaying] = useState<Leaf | null>(null);

  const album = useLoad(async () => (await API.album.list(productId, plantId)) as AlbumData, [productId, plantId]);
  const data = album.data;
  const leaves = (data?.images || []) as Leaf[];
  const perStage = data ? data.leavesPerStage ?? null : null;

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const leaf of leaves) if (leaf.stage) map.set(leaf.stage, (map.get(leaf.stage) || 0) + 1);
    return map;
  }, [leaves]);
  const allFull = Boolean(data?.stages.length) && perStage !== null && data!.stages.every((st) => (counts.get(st.id) || 0) >= perStage);

  const groups = useMemo(() => {
    const stages = data?.stages || [];
    const byStage = new Map<string, Leaf[]>();
    const undated: Leaf[] = [];
    for (const leaf of leaves) {
      if (!leaf.stage) undated.push(leaf);
      else byStage.set(leaf.stage, [...(byStage.get(leaf.stage) || []), leaf]);
    }
    const ordered: Array<{ id: string; label: string; icon: IconName; items: Leaf[] }> = stages
      .map((st, index) => ({ ...st, index }))
      .filter((st) => byStage.has(st.id))
      .sort((a, b) => b.index - a.index)
      .map((st) => ({ id: st.id as string, label: st.label, icon: st.icon, items: byStage.get(st.id) as Leaf[] }));
    if (undated.length) ordered.push({ id: 'unknown', label: 'Chưa rõ chặng', icon: 'album', items: undated });
    return ordered;
  }, [leaves, data]);

  const shown = filter === 'all' ? groups : groups.filter((g) => g.id === filter);
  const target = filter !== 'all' && filter !== 'unknown' ? filter : data?.plant?.stage || '';

  async function add(from: 'library' | 'camera') {
    try {
      const picked = await pickMedia(from, { videos: true });
      if (picked?.[0]) setComposing(picked[0]);
    } catch (err: any) {
      toast(err?.message || 'Chưa mở được ảnh.', 'error');
    }
  }

  const inner = Math.min(width, maxWidth) - gutter * 2;
  const cols = inner >= 640 ? 5 : inner >= 480 ? 4 : 3;
  const tile = Math.floor((inner - 8 * (cols - 1)) / cols);
  const plant = data?.plant;

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Album kỷ niệm" back={plantId ? `/plant/${plantId}` : '/garden'} onRefresh={album.reload} bar>
        {album.loading && !data && <Loading />}
        {album.error ? <ErrorNote message={album.error} onRetry={album.reload} /> : null}

        {data && (
          <>
            <View style={{ gap: 2 }}>
              <H>{plant?.nickname || data.product?.name || 'Album kỷ niệm'}</H>
              <T muted>{leaves.length} khoảnh khắc{perStage !== null ? ` · mỗi chặng ${perStage} lá` : ' · VIP không giới hạn'}</T>
            </View>

            {(data.plants?.length || 0) > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {data.plants!.map((p) => (
                  <Chip key={p.id} icon="sprout" label={p.nickname} on={p.id === (plant?.id || plantId)} onPress={() => router.setParams({ plantId: p.id })} />
                ))}
              </ScrollView>
            )}

            {groups.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Chip label={`Tất cả · ${leaves.length}`} on={filter === 'all'} onPress={() => setFilter('all')} />
                {groups.map((g) => <Chip key={g.id} icon={g.icon} label={`${g.label} · ${g.items.length}`} on={filter === g.id} onPress={() => setFilter(g.id)} />)}
              </ScrollView>
            )}

            {leaves.length === 0 && (
              <Empty art={imageSource('/assets/images/sprouty-icons/AddPhoto.png') as number} title="Album còn trống"
                text="Chụp ảnh cây mỗi khi cây lớn thêm một chặng — mỗi ảnh là một chiếc lá trên cây kỷ niệm của bé." />
            )}

            {shown.map((g) => (
              <View key={g.id} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name={g.icon} size={18} color={colors.green} />
                  <T bold style={{ flex: 1 }}>{g.label}</T>
                  <T muted>{g.items.length}{perStage !== null && g.id !== 'unknown' ? `/${perStage}` : ''}</T>
                </View>
                <View style={s.grid}>
                  {g.items.map((leaf) => (
                    <Pressable key={leaf.id} onPress={() => setViewing(leaf)} style={[s.tile, { width: tile, height: tile }]} accessibilityLabel={leaf.title || 'Khoảnh khắc'}>
                      {leaf.status === 'hidden' ? (
                        <View style={s.tileHidden}><Icon name="lock" size={20} color={colors.ink4} /></View>
                      ) : isVideo(leaf) ? (
                        <View style={[s.tileHidden, { backgroundColor: colors.ink2 }]}><Icon name="camera" size={22} color={colors.white} /></View>
                      ) : (
                        <Image source={imageSource(leaf.url)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                      )}
                      {leaf.title ? <View style={s.caption}><Text numberOfLines={1} style={s.captionText}>{leaf.title}</Text></View> : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </Screen>

      {data && (
        <ActionBar>
            {allFull ? (
              <View style={{ flex: 1, gap: 6 }}>
                <T muted>Các chặng đã đủ lá. VIP Garden không giới hạn số ảnh.</T>
                <Button small title="Xem VIP Garden" onPress={() => router.push('/vip')} />
              </View>
            ) : (
              <>
                <Button grow variant="soft" icon="album" title="Chọn từ máy" onPress={() => add('library')} />
                <Button grow icon="camera" title="Chụp ảnh" onPress={() => add('camera')} />
              </>
            )}
        </ActionBar>
      )}

      {data && (
        <ComposeSheet asset={composing} album={data} counts={counts} productId={productId} plantId={plant?.id || plantId}
          initialStage={target} onClose={() => setComposing(null)} onUploaded={album.reload} />
      )}
      <LeafSheet leaf={viewing} onClose={() => setViewing(null)} onChanged={album.reload} onPlay={(leaf) => { setViewing(null); setPlaying(leaf); }} />
      <VideoModal uri={playing?.url ?? null} title={playing?.title || 'Video kỷ niệm'} onClose={() => setPlaying(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  pick: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  pickArt: { width: 72, height: 72, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.greenSoft },
  tileHidden: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1EA' },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: 'rgba(32,52,36,0.55)' },
  captionText: { fontFamily: fonts.semi, fontSize: 11, color: colors.white },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.greenSoft },
  videoPreview: { alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.ink2 },
  videoText: { fontFamily: fonts.semi, fontSize: 14, color: colors.white },
  play: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  stageWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stage: { minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  stageOn: { backgroundColor: colors.green, borderColor: colors.green },
  stageText: { fontFamily: fonts.semi, fontSize: 13.5, color: colors.ink2 },
  stageCount: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink4 },
});
