import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { API, mediaUrl } from '@/lib/api';
import { colors, fonts } from '@/theme';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { IconButton, Loading } from './ui';

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => { p.play(); });
  return <VideoView style={{ width: '100%', aspectRatio: 16 / 9 }} player={player} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />;
}

/** A video, full screen over the app. Private files carry the media pass (lib/api.ts). */
export function VideoModal({ uri, title, onClose }: { uri: string | null; title?: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={Boolean(uri)} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={[s.dark, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.bar}>
          <Text numberOfLines={1} style={s.title}>{title}</Text>
          <IconButton icon="close" label="Đóng" color={colors.white} onPress={onClose} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>{uri ? <Player uri={mediaUrl(uri)} /> : null}</View>
      </View>
    </Modal>
  );
}

interface VideoItem { id: string; title: string; durationSec: number | null; progress: { completedAt: string | null } | null }

const minutes = (sec?: number | null) => (sec ? `${Math.max(1, Math.round(sec / 60))} phút` : '');

/**
 * A kit's instruction videos. Anyone sees how many there are; the videos
 * themselves open once the kit is bought or its code activated.
 */
export function ProductVideos({ productId, signedIn }: { productId: number; signedIn: boolean }) {
  const toast = useToast();
  const [videos, setVideos] = useState<VideoItem[] | null>(null);
  const [summary, setSummary] = useState<Array<{ title: string; durationSec: number | null }>>([]);
  const [locked, setLocked] = useState('');
  const [playing, setPlaying] = useState<{ uri: string; title: string } | null>(null);
  const [opening, setOpening] = useState('');

  useEffect(() => {
    API.videos.summary(productId).then((d: any) => setSummary(d.items || [])).catch(() => {});
    if (!signedIn) { setLocked('Đăng nhập và mua bộ kit để xem video hướng dẫn.'); return; }
    API.videos.forProduct(productId)
      .then((d: any) => setVideos(d.videos || []))
      .catch((err: any) => setLocked(err?.message || 'Mua bộ kit để xem video hướng dẫn.'));
  }, [productId, signedIn]);

  async function play(video: VideoItem) {
    setOpening(video.id);
    try {
      const { video: full } = await API.videos.get(video.id);
      if (full.externalUrl) await WebBrowser.openBrowserAsync(full.externalUrl);
      else if (full.url) setPlaying({ uri: full.url, title: full.title });
    } catch (err: any) {
      toast(err?.message || 'Chưa mở được video.', 'error');
    } finally {
      setOpening('');
    }
  }

  if (!summary.length && !videos?.length) return <Text style={s.muted}>Bộ kit này chưa có video hướng dẫn.</Text>;
  return (
    <View style={{ gap: 8 }}>
      {locked ? (
        <>
          <View style={s.lock}><Icon name="lock" size={18} color={colors.earth} /><Text style={[s.muted, { flex: 1 }]}>{locked}</Text></View>
          {summary.map((v, i) => (
            <View key={i} style={s.video}><Icon name="camera" size={20} color={colors.ink4} /><Text style={s.videoTitle}>{v.title}</Text><Text style={s.muted}>{minutes(v.durationSec)}</Text></View>
          ))}
        </>
      ) : !videos ? <Loading /> : videos.map((v) => (
        <Pressable key={v.id} onPress={() => play(v)} style={({ pressed }) => [s.video, pressed && { backgroundColor: colors.greenSoft }]}>
          <View style={s.playIcon}><Icon name="arrow-right" size={18} color={colors.white} /></View>
          <Text style={s.videoTitle}>{v.title}</Text>
          <Text style={s.muted}>{opening === v.id ? 'Đang mở…' : v.progress?.completedAt ? 'Đã xem' : minutes(v.durationSec)}</Text>
        </Pressable>
      ))}
      <VideoModal uri={playing?.uri ?? null} title={playing?.title} onClose={() => setPlaying(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  dark: { flex: 1, backgroundColor: '#000' },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  title: { flex: 1, color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, color: colors.ink3 },
  lock: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: colors.earthSoft },
  video: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  videoTitle: { flex: 1, fontFamily: fonts.semi, fontSize: 15, color: colors.ink },
  playIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
});
