import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { VideoModal } from '@/components/media';
import { PlantThumb } from '@/components/PlantThumb';
import { MemoryTreeArt } from '@/components/MemoryTreeArt';
import { AlbumStageTree } from '@/components/AlbumStageTree';
import { useToast } from '@/components/Toast';
import { ActionBar, Button, Card, Chip, cheer, Empty, ErrorNote, Field, H, Loading, Screen, Sheet, T } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { albumCaptionSuggestions } from '@/lib/album-caption';
import { filePart, isVideoAsset, pickMedia, type Picked } from '@/lib/photos';
import type { Album, AlbumLeaf, PlantCard } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme';

type AlbumData = Album & { plants?: Array<{ id: string; nickname: string }>; status?: string };
type Leaf = AlbumLeaf & { status?: 'active' | 'hidden' };

const isVideo = (leaf: Leaf) => (leaf.asset?.mimeType || '').startsWith('video/');
const searchText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

/** Choosing whose album to open, when the garden's album button is tapped. */
function PlantPicker() {
  const plants = useLoad(async () => (await API.plants.list()).plants as PlantCard[]);
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('all');
  const [species, setSpecies] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const stages = [...new Map((plants.data || []).map((p) => [p.stage, p.stageLabel])).entries()];
  const speciesOptions = [...new Set((plants.data || []).map((p) => p.speciesLabel))];
  const visible = (plants.data || []).filter((p) =>
    (stage === 'all' || p.stage === stage) && (species === 'all' || p.speciesLabel === species)
    && searchText(p.nickname + ' ' + p.speciesLabel).includes(searchText(query)));
  const reset = () => { setQuery(''); setStage('all'); setSpecies('all'); };
  return (
    <Screen title="Album kỷ niệm" back="/garden" onRefresh={plants.reload}>
      <T muted>Mỗi cây có một album riêng: ảnh và video bé chụp theo từng chặng lớn của cây.</T>
      <Field label="Tìm album" value={query} onChangeText={setQuery} placeholder="Tên cây hoặc loại cây…" autoCapitalize="none" returnKeyType="search" />
      <View style={s.filterBar}>
        <T muted style={{ flex: 1 }}>{visible.length}/{plants.data?.length || 0} album</T>
        <Button small variant="soft" title={`Bộ lọc${stage !== 'all' || species !== 'all' ? ' · đang chọn' : ''}`} onPress={() => setFiltersOpen(true)} />
        {(query || stage !== 'all' || species !== 'all') ? <Button small variant="ghost" title="Xóa lọc" onPress={reset} /> : null}
      </View>
      {(stage !== 'all' || species !== 'all') && <T muted style={{ fontSize: 12 }}>{[species !== 'all' ? species : '', stage !== 'all' ? stages.find(([id]) => id === stage)?.[1] : ''].filter(Boolean).join(' · ')}</T>}
      {plants.loading && <Loading />}
      {plants.error ? <ErrorNote message={plants.error} onRetry={plants.reload} /> : null}
      {plants.data?.length === 0 && (
        <Empty title="Chưa có cây nào" text="Kích hoạt một bộ kit để bắt đầu album đầu tiên của bé.">
          <Button title="Kích hoạt cây" icon="seed" onPress={() => router.replace('/garden?activate=1')} />
        </Empty>
      )}
      {!plants.loading && Boolean(plants.data?.length) && !visible.length && <Card><T bold>Không tìm thấy album</T><T muted>Thử tên khác hoặc xóa bộ lọc nhé.</T><Button small variant="soft" title="Xóa bộ lọc" onPress={reset} /></Card>}
      {visible.map((p) => (
        <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Album ${p.nickname}`} onPress={() => router.push(`/album?productId=${p.productId}&plantId=${p.id}`)} style={({ pressed }) => [s.pick, pressed && { backgroundColor: colors.greenSoft }]}>
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
      <Sheet open={filtersOpen} title="Lọc album" onClose={() => setFiltersOpen(false)} footer={<Button title={`Xem ${visible.length} album`} onPress={() => setFiltersOpen(false)} />}>
        <T bold>Loại cây</T>
        <View style={s.stageWrap}><Chip label="Tất cả" on={species === 'all'} onPress={() => setSpecies('all')} />
          {speciesOptions.map((name) => <Chip key={name} label={name} on={species === name} onPress={() => setSpecies(name)} />)}</View>
        <T bold>Giai đoạn hiện tại</T>
        <View style={s.stageWrap}><Chip label="Tất cả" on={stage === 'all'} onPress={() => setStage('all')} />
          {stages.map(([id, label]) => <Chip key={id} label={label} on={stage === id} onPress={() => setStage(id)} />)}</View>
      </Sheet>
    </Screen>
  );
}

/** Adding a leaf: the photo, which stage's branch it goes on, an editable suggested name, a diary line. */
function ComposeSheet({ asset, album, counts, onClose, onUploaded, productId, plantId, initialStage, onStageChange }: {
  asset: Picked | null; album: AlbumData; counts: Map<string, number>; onClose: () => void; onUploaded: (stage: string) => void;
  productId: string; plantId: string; initialStage: string; onStageChange: (stage: string) => void;
}) {
  const toast = useToast();
  const perStage = album.leavesPerStage ?? null;
  const isFull = (id: string) => perStage !== null && (counts.get(id) || 0) >= perStage;
  const [stage, setStage] = useState('');
  const [changingStage, setChangingStage] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [suggestionInfo, setSuggestionInfo] = useState('');
  useEffect(() => {
    setSuggestionInfo('');
  }, [asset, stage]);
  const [seen, setSeen] = useState<string | null>(null);

  // A fresh form for each new photo.
  if (asset && seen !== asset.uri) {
    setSeen(asset.uri);
    const selected = album.stages.find((st) => st.id === initialStage)?.id || album.stages.find((st) => !isFull(st.id))?.id || '';
    setStage(selected);
    setChangingStage(!selected || isFull(selected));
    setTitle('');
    setNote('');
    setBusy(false);
    setUploadError('');
  }
  if (!asset && seen) setSeen(null);
  const video = asset ? isVideoAsset(asset) : false;

  const suggestions = albumCaptionSuggestions(album.plant?.nickname || album.product?.name || 'Cây của bé', stage,
    album.stages.find((st) => st.id === stage)?.label || '');
  function suggest() {
    if (!asset || busy) return;
    setTitle(suggestions[(suggestions.indexOf(title) + 1) % suggestions.length]);
    setSuggestionInfo('Tên gợi ý theo chặng của cây. Chọn một tên bên dưới hoặc sửa theo ý bạn.');
  }

  async function submit() {
    if (!asset || !stage || busy || isFull(stage)) return;
    setUploadError('');
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
      onUploaded(stage);
      onClose();
    } catch (err: any) {
      setUploadError(err?.message || 'Chưa đăng được. Vui lòng thử lại.');
      setBusy(false);
    }
  }

  return (
    <Sheet open={Boolean(asset)} title="Thêm khoảnh khắc" onClose={() => !busy && onClose()}
      footer={<Button title={busy ? 'Đang đăng…' : 'Đăng lên cây'} icon="sprout" busy={busy} disabled={!stage || isFull(stage)} onPress={submit} />}>
      {uploadError ? <View accessibilityLiveRegion="polite" style={{ padding: 12, borderRadius: radius.sm, backgroundColor: colors.badSoft }}>
        <Text style={{ color: colors.bad, fontFamily: fonts.medium }}>{uploadError}</Text>
        <T muted style={{ fontSize: 12 }}>Ảnh và nội dung vẫn được giữ để bạn thử lại.</T>
      </View> : null}
      {asset && (
        <View style={s.preview}>
          {video ? (
            <View style={s.videoPreview}><Icon name="camera" size={34} color={colors.white} /><Text style={s.videoText}>Video đã chọn</Text></View>
          ) : <Image source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
        </View>
      )}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.greenSoft }}>
          <Icon name={album.stages.find((st) => st.id === stage)?.icon || 'sprout'} size={24} color={colors.greenDark} />
          <View style={{ flex: 1, gap: 3 }}><T muted style={{ fontSize: 12 }}>Lưu vào chặng</T><T bold>{album.stages.find((st) => st.id === stage)?.label || 'Chọn chặng'}</T></View>
          <Pressable disabled={busy} onPress={() => setChangingStage((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: changingStage, disabled: busy }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}><T bold style={{ fontSize: 13, color: colors.greenDark }}>{changingStage ? 'Thu gọn' : 'Đổi chặng'}</T></Pressable>
        </View>
        {isFull(stage) && <T style={{ color: colors.bad, fontSize: 13 }}>Chặng này đã đủ ảnh. Đổi chặng để tiếp tục.</T>}
        {changingStage && <View style={s.stageWrap}>
          {album.stages.map((st) => {
            const full = isFull(st.id);
            const n = counts.get(st.id) || 0;
            const on = stage === st.id;
            return (
              <Pressable key={st.id} disabled={full || busy} onPress={() => { setStage(st.id); onStageChange(st.id); setChangingStage(false); }} style={[s.stage, on && s.stageOn, full && { opacity: 0.45 }]}
                accessibilityRole="radio" accessibilityState={{ checked: on, disabled: full }}>
                <Icon name={st.icon} size={15} color={on ? colors.white : colors.green} />
                <Text style={[s.stageText, on && { color: colors.white }]}>{st.label}{album.plant?.stage === st.id ? ' · hiện tại' : ''}</Text>
                <Text style={[s.stageCount, on && { color: colors.white }]}>{full ? 'Đủ' : perStage !== null ? `${n}/${perStage}` : n || ''}</Text>
              </Pressable>
            );
          })}
        </View>}
      </View>
      <Field label="Tên khoảnh khắc" value={title} onChangeText={setTitle} editable={!busy} maxLength={120} placeholder="VD: Mầm đầu tiên nhú lên" />
      <Button small variant="soft" icon="pencil" title={suggestionInfo ? 'Gợi ý tên khác' : 'Gợi ý tên'} disabled={busy} onPress={suggest} />
      {suggestionInfo ? <View style={{ gap: 6 }}>{suggestions.map((name) => <Pressable key={name} disabled={busy} onPress={() => setTitle(name)}
        accessibilityRole="radio" accessibilityState={{ checked: title === name, disabled: busy }}
        style={{ minHeight: 44, padding: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: title === name ? colors.green : colors.line, backgroundColor: title === name ? colors.greenSoft : colors.card, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink }}>{name}</Text>
        {title === name && <Icon name="check" size={16} color={colors.greenDark} />}
      </Pressable>)}</View> : null}
      {suggestionInfo ? <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.ink3 }} accessibilityLiveRegion="polite">{suggestionInfo}</Text> : null}
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
  return <PlantAlbum key={`${params.productId}:${params.plantId || ''}`} productId={String(params.productId)} plantId={String(params.plantId || '')} />;
}

function PlantAlbum({ productId, plantId }: { productId: string; plantId: string }) {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState('all');
  const [treeOpen, setTreeOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [media, setMedia] = useState<'all' | 'photo' | 'video'>('all');
  const [oldestFirst, setOldestFirst] = useState(false);
  const [page, setPage] = useState(0);
  const chooseStage = (stage: string) => { setFilter(stage); setPage(0); setStageOpen(false); setTreeOpen(false); };
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

  const target = filter !== 'all' && filter !== 'unknown' ? filter : data?.plant?.stage || '';
  const selectedFull = filter !== 'all' && filter !== 'unknown' && perStage !== null && (counts.get(filter) || 0) >= perStage;

  async function add(from: 'library' | 'camera') {
    try {
      const picked = await pickMedia(from, { videos: true });
      if (picked?.[0]) setComposing(picked[0]);
    } catch (err: any) {
      toast(err?.message || 'Chưa mở được ảnh.', 'error');
    }
  }

  const inner = Math.min(width, maxWidth) - gutter * 2;
  const plant = data?.plant;
  const stageLabel = filter === 'all' ? 'Mọi chặng' : filter === 'unknown' ? 'Chưa rõ chặng' : data?.stages.find((st) => st.id === filter)?.label || 'Chọn chặng';
  const filtered = leaves.filter((leaf) =>
    (filter === 'all' || (filter === 'unknown' ? !leaf.stage : leaf.stage === filter))
    && (media === 'all' || (media === 'video' ? isVideo(leaf) : !isVideo(leaf)))
    && searchText((leaf.title || '') + ' ' + (leaf.note || '')).includes(searchText(query)))
    .sort((a, b) => (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * (oldestFirst ? 1 : -1) || a.id.localeCompare(b.id));
  const cols = inner >= 640 ? 5 : inner >= 480 ? 4 : 3;
  const tile = Math.floor((inner - 4 * (cols - 1)) / cols);
  // Three rows per page, regardless of album size or device orientation.
  const pageSize = cols * 3;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const startIndex = currentPage * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);
  const sections = filter === 'all'
    ? [
      ...(data?.stages || []).map((st) => ({ id: st.id as string, label: st.label, icon: st.icon, items: filtered.filter((leaf) => leaf.stage === st.id) })),
      { id: 'unknown', label: 'Chưa rõ chặng', icon: 'album' as IconName, items: filtered.filter((leaf) => !leaf.stage) },
    ].filter((section) => section.items.length > 0)
    : [{ id: filter, label: stageLabel, icon: 'album' as IconName, items: pageItems }];

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Album kỷ niệm" back={plantId ? `/plant/${plantId}` : '/garden'} onRefresh={album.reload} bar>
        {album.loading && !data && <Loading />}
        {album.error ? <ErrorNote message={album.error} onRetry={album.reload} /> : null}

        {data && (
          <>
            <View style={[s.albumCover, treeOpen && { minHeight: 0, padding: 14 }]}>
              <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                {!treeOpen && <Text style={s.coverEyebrow}>NHẬT KÝ LỚN LÊN</Text>}
                <H size={treeOpen ? 21 : 26} style={{ color: '#F8F7ED' }}>{plant?.nickname || data.product?.name || 'Cây của bé'}</H>
                <Text style={s.coverSummary}>{leaves.length} kỷ niệm · {data.stages.filter((st) => counts.has(st.id)).length}/{data.stages.length} chặng</Text>
              </View>
              {!treeOpen && <View pointerEvents="none" style={s.coverArt}><MemoryTreeArt /></View>}
            </View>
            {(data.plants?.length || 0) > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {data.plants!.map((p) => <Chip key={p.id} icon="sprout" label={p.nickname} on={p.id === (plant?.id || plantId)} onPress={() => router.setParams({ plantId: p.id })} />)}
              </ScrollView>
            )}
            <View style={s.albumTabs}>
              <Pressable style={[s.albumTab, treeOpen && s.albumTabOn]} onPress={() => setTreeOpen(true)} accessibilityRole="tab" accessibilityState={{ selected: treeOpen }}><Icon name="sprout" size={18} color={treeOpen ? colors.greenDark : colors.ink3} /><Text style={[s.albumTabText, treeOpen && { color: colors.greenDark }]}>Hành trình</Text></Pressable>
              <Pressable style={[s.albumTab, !treeOpen && s.albumTabOn]} onPress={() => setTreeOpen(false)} accessibilityRole="tab" accessibilityState={{ selected: !treeOpen }}><Icon name="album" size={18} color={!treeOpen ? colors.greenDark : colors.ink3} /><Text style={[s.albumTabText, !treeOpen && { color: colors.greenDark }]}>Thư viện</Text></Pressable>
            </View>
            {!treeOpen && <View style={{ gap: 12 }}>
            <View style={s.galleryToolbar}>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}><Text style={s.galleryTitle}>{filter === 'all' ? 'Tất cả kỷ niệm' : stageLabel}</Text><Text style={s.gallerySubtitle}>{filtered.length} {media === 'video' ? 'video' : media === 'photo' ? 'ảnh' : 'khoảnh khắc'} · {oldestFirst ? 'Cũ nhất trước' : 'Mới nhất trước'}</Text></View>
              <Pressable style={[s.toolbarButton, (searchOpen || !!query) && s.toolbarButtonOn]} onPress={() => setSearchOpen((open) => !open)} accessibilityRole="button" accessibilityLabel="Tìm kiếm ảnh" accessibilityState={{ expanded: searchOpen }}><Icon name="search" size={20} color={colors.greenDark} /></Pressable>
              <Pressable style={[s.toolbarButton, (filter !== 'all' || media !== 'all' || oldestFirst) && s.toolbarButtonOn]} onPress={() => setStageOpen(true)} accessibilityRole="button" accessibilityLabel="Lọc và sắp xếp"><Icon name="filter" size={20} color={colors.greenDark} /></Pressable>
            </View>
            {(searchOpen || !!query) && <View style={s.searchBox}><TextInput style={s.searchInput} value={query} onChangeText={(value) => { setQuery(value); setPage(0); }} placeholder="Tên ảnh hoặc nhật ký…" placeholderTextColor={colors.ink3} accessibilityLabel="Tìm khoảnh khắc" autoCapitalize="none" returnKeyType="search" /><Pressable style={s.toolbarButton} onPress={() => { setQuery(''); setSearchOpen(false); setPage(0); }} accessibilityRole="button" accessibilityLabel="Đóng tìm kiếm"><Icon name="close" size={18} color={colors.ink3} /></Pressable></View>}
            {!filtered.length && <Card>
              <T bold>{leaves.length ? 'Chưa có khoảnh khắc phù hợp' : 'Lưu kỷ niệm đầu tiên'}</T>
              <T muted>{leaves.length ? 'Chọn chặng khác, đổi bộ lọc hoặc thêm ảnh vào chặng này.' : 'Chọn ảnh hoặc chụp cây để bắt đầu hành trình.'}</T>
              {(query || filter !== 'all' || media !== 'all') && <Button small variant="soft" title="Xóa bộ lọc" onPress={() => { setQuery(''); setMedia('all'); chooseStage('all'); }} />}
            </Card>}
            {sections.map((section) => <View key={section.id} style={{ gap: 8, marginBottom: filter === 'all' ? 12 : 0 }}>
              {filter === 'all' && <View style={s.sectionHeading}>
                <Icon name={section.icon} size={20} color={colors.greenDark} />
                <View style={{ flex: 1, minWidth: 0 }}><Text style={s.galleryTitle}>{section.label}</Text><Text style={s.gallerySubtitle}>{section.items.length} khoảnh khắc</Text></View>
                <Pressable onPress={() => chooseStage(section.id)} accessibilityRole="button" accessibilityLabel={`Xem tất cả ảnh chặng ${section.label}`} style={s.sectionLink}><Text style={s.sectionLinkText}>Xem tất cả</Text><Icon name="arrow-right" size={15} color={colors.greenDark} /></Pressable>
              </View>}
            <View style={s.grid}>
              {(filter === 'all' ? section.items.slice(0, cols) : section.items).map((leaf) => <Pressable key={leaf.id} onPress={() => setViewing(leaf)} style={[s.tile, { width: tile }]} accessibilityRole="button" accessibilityLabel={(leaf.title || 'Khoảnh khắc') + ', ' + (leaf.stageLabel || 'Chưa rõ chặng')}>
                <View style={{ height: tile, overflow: 'hidden', borderRadius: 6 }}>
                {leaf.status === 'hidden' ? <View style={s.tileHidden}><Icon name="lock" size={20} color={colors.ink4} /></View>
                  : isVideo(leaf) ? <View style={[s.tileHidden, { backgroundColor: colors.ink2 }]}><Icon name="camera" size={22} color={colors.white} /></View>
                  : <Image source={imageSource(leaf.url)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />}
                </View>
                <View style={s.caption}>
                  <Text numberOfLines={1} style={s.captionText}>{leaf.title?.trim() || 'Chưa đặt tên'}</Text>
                </View>
              </Pressable>)}
            </View>
            </View>)}
            {filter !== 'all' && pageCount > 1 && <View style={s.pagination}>
              <Button small variant="ghost" title="Trước" disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)} />
              <T muted>{currentPage + 1} / {pageCount}</T>
              <Button small variant="soft" title="Tiếp" disabled={currentPage >= pageCount - 1} onPress={() => setPage(currentPage + 1)} />
            </View>}
            </View>}
            {treeOpen && <View style={{ gap: 10 }}>
              <View style={{ alignItems: 'center', gap: 4 }}><H size={20}>Cây kỷ niệm</H><Text style={s.treeSummary}>Chạm một nhánh để xem và thêm ảnh.</Text></View>
              <AlbumStageTree selected={filter} onSelect={(stage) => { chooseStage(stage); setQuery(''); setMedia('all'); setAddOpen(false); }} stages={data.stages.map((st) => ({
                id: st.id, label: st.label, icon: st.icon, count: counts.get(st.id) || 0,
                current: plant?.stage === st.id,
                cover: leaves.find((leaf) => leaf.stage === st.id && leaf.status !== 'hidden' && !isVideo(leaf))?.url,
              }))} />
            </View>}
          </>
        )}
      </Screen>

      {data && (
        <ActionBar>
            {allFull || selectedFull ? (
              <View style={{ flex: 1, gap: 6 }}>
                <T muted>{selectedFull ? 'Chặng này đã đủ lá. Chọn nhánh khác để thêm ảnh.' : 'Các chặng đã đủ lá. VIP Garden không giới hạn số ảnh.'}</T>
                <Button small title="Xem VIP Garden" onPress={() => router.push('/vip')} />
              </View>
            ) : (
              <View style={{ flex: 1, gap: 12 }}>
                {addOpen && <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button grow small variant="soft" icon="album" title="Thư viện" onPress={() => { setAddOpen(false); void add('library'); }} />
                  <Button grow small variant="soft" icon="camera" title="Máy ảnh" onPress={() => { setAddOpen(false); void add('camera'); }} />
                </View>}
              <View style={s.addBar}>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}><Text style={s.galleryTitle}>Lưu một kỷ niệm</Text><Text style={s.gallerySubtitle}>{filter !== 'all' && filter !== 'unknown' ? stageLabel : 'Một chút lớn lên mỗi ngày'}</Text></View>
                <Pressable style={s.addButton} onPress={() => setAddOpen((open) => !open)} accessibilityRole="button" accessibilityLabel={addOpen ? 'Đóng lựa chọn thêm ảnh' : 'Thêm ảnh hoặc video'} accessibilityState={{ expanded: addOpen }}><Icon name={addOpen ? 'close' : 'add'} size={20} color="#FFFFFF" /><Text style={s.addButtonText}>{addOpen ? 'Đóng' : 'Thêm ảnh'}</Text></Pressable>
              </View>
              </View>
            )}
        </ActionBar>
      )}

      {data && stageOpen && <Sheet open={stageOpen} title="Lọc khoảnh khắc" onClose={() => setStageOpen(false)}>
        <T bold>Loại kỷ niệm</T>
        <View style={s.filterBar}>
          {([{ id: 'all', label: 'Tất cả' }, { id: 'photo', label: 'Ảnh' }, { id: 'video', label: 'Video' }] as const).map((item) => <Chip key={item.id} label={item.label} on={media === item.id} onPress={() => { setMedia(item.id); setPage(0); }} />)}
        </View>
        <T bold>Sắp xếp</T>
        <View style={s.filterBar}>
          <Chip label="Mới nhất trước" on={!oldestFirst} onPress={() => { setOldestFirst(false); setPage(0); }} />
          <Chip label="Cũ nhất trước" on={oldestFirst} onPress={() => { setOldestFirst(true); setPage(0); }} />
        </View>
        <T bold>Chặng của cây</T>
        <View style={s.stageWrap}>
          <Chip label={'Mọi chặng · ' + leaves.length} on={filter === 'all'} onPress={() => { setFilter('all'); setPage(0); }} />
          {data.stages.map((st) => <Chip key={st.id} icon={st.icon} label={st.label + ' · ' + (counts.get(st.id) || 0)} on={filter === st.id} onPress={() => { setFilter(st.id); setPage(0); }} />)}
          {leaves.some((leaf) => !leaf.stage) && <Chip label="Chưa rõ chặng" on={filter === 'unknown'} onPress={() => { setFilter('unknown'); setPage(0); }} />}
        </View>
        <Button title={`Xem ${filtered.length} khoảnh khắc`} onPress={() => setStageOpen(false)} />
        <Button title="Đặt lại bộ lọc" variant="ghost" onPress={() => { setFilter('all'); setMedia('all'); setOldestFirst(false); setPage(0); }} />
      </Sheet>}
      {data && (
        <ComposeSheet asset={composing} album={data} counts={counts} productId={productId} plantId={plant?.id || plantId}
          initialStage={target} onStageChange={(stage) => { setFilter(stage); setPage(0); }} onClose={() => setComposing(null)} onUploaded={(stage) => { chooseStage(stage); setQuery(''); setMedia('all'); setOldestFirst(false); void album.reload(); }} />
      )}
      <LeafSheet leaf={viewing} onClose={() => setViewing(null)} onChanged={album.reload} onPlay={(leaf) => { setViewing(null); setPlaying(leaf); }} />
      <VideoModal uri={playing?.url ?? null} title={playing?.title || 'Video kỷ niệm'} onClose={() => setPlaying(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  sectionLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  sectionLinkText: { fontFamily: fonts.semi, fontSize: 11, color: colors.greenDark },
  albumCover: { flexDirection: 'row', alignItems: 'center', minHeight: 154, padding: 20, gap: 8, backgroundColor: '#304D3D', borderRadius: 20, overflow: 'hidden' },
  coverEyebrow: { fontFamily: fonts.semi, fontSize: 10, letterSpacing: 1.6, color: '#CCD8C7' },
  coverSummary: { fontFamily: fonts.medium, fontSize: 12, color: '#D8E3D2', lineHeight: 19 },
  coverArt: { width: '30%', maxWidth: 130, aspectRatio: 800 / 760, backgroundColor: '#E8EDDC', borderRadius: 60 },
  albumTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  albumTab: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  albumTabOn: { borderBottomColor: colors.greenDark },
  albumTabText: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink3 },
  galleryToolbar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  galleryTitle: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink },
  gallerySubtitle: { fontFamily: fonts.body, fontSize: 11, lineHeight: 17, color: colors.ink3 },
  toolbarButton: { width: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  toolbarButtonOn: { backgroundColor: '#E6EDDE' },
  addBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#304D3D' },
  addButtonText: { fontFamily: fonts.semi, fontSize: 14, color: '#FFFFFF' },
  searchBox: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.card },
  searchInput: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 10, fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  filterButton: { width: 48, minHeight: 48, borderRadius: 14, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  filterBar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  uploadTarget: { fontFamily: fonts.medium, fontSize: 11, color: colors.ink3, textAlign: 'center' },
  memoryTree: { gap: 16 },
  treeHero: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.lg, backgroundColor: '#F0F4E8' },
  treeIllustration: { width: '43%', aspectRatio: 800 / 760 },
  treeEyebrow: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.7, color: colors.earth },
  treeSummary: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: colors.ink3 },
  journeyIntro: { gap: 3 },
  branches: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  branch: { minHeight: 106, padding: 10, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, gap: 7 },
  branchCurrent: { borderColor: '#A9C89C', backgroundColor: '#F5F9F0' },
  branchSelected: { borderColor: colors.green, backgroundColor: '#ECF9E8' },
  branchTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 18 },
  currentTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: '#DFEDD7' },
  currentText: { fontFamily: fonts.bold, fontSize: 9, color: colors.greenDark },
  branchBody: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  branchPhoto: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#E1EDD6', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  branchEmpty: { backgroundColor: '#F0F4EB' },
  branchNumber: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink3 },
  branchLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.ink },
  branchCount: { fontFamily: fonts.medium, fontSize: 11, color: colors.ink3 },
  treeFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  treeRoot: { fontFamily: fonts.semi, fontSize: 12, color: colors.earth, textAlign: 'center' },
  treeLink: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream2 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 8 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  pickArt: { width: 72, height: 72, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 4, rowGap: 14 },
  tile: { borderRadius: 4, overflow: 'hidden' },
  tileHidden: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1EA' },
  caption: { paddingTop: 6, paddingHorizontal: 2, gap: 4 },
  captionText: { fontFamily: fonts.semi, fontSize: 12, lineHeight: 18, color: colors.ink },
  photoStage: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  photoStageText: { flex: 1, fontFamily: fonts.medium, fontSize: 10, lineHeight: 15, color: colors.greenDark },
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
