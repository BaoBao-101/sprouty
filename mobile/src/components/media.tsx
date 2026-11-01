import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { WebView } from 'react-native-webview';
import { API, mediaUrl } from '@/lib/api';
import { WEB_ORIGIN } from '@/lib/config';
import { colors, fonts, shadow } from '@/theme';
import { Icon } from './Icon';
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

interface VideoItem {
  id: string;
  title: string;
  description?: string | null;
  durationSec: number | null;
  thumbnailUrl?: string | null;
  externalUrl?: string | null;
  progress: { progressSec?: number; completedAt: string | null } | null;
}

const minutes = (sec?: number | null) => (sec ? `${Math.max(1, Math.round(sec / 60))} phút` : '');

function youTubeId(url?: string | null) {
  const m = url && (url.match(/youtu\.be\/([\w-]{6,})/i) || url.match(/youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)([\w-]{6,})/i));
  return m ? m[1] : null;
}

/** How far through a video the child is, 0–1. */
function watched(video: VideoItem) {
  if (video.progress?.completedAt) return 1;
  if (!video.durationSec || !video.progress?.progressSec) return 0;
  return Math.min(1, video.progress.progressSec / video.durationSec);
}

function statusOf(video: VideoItem) {
  const share = watched(video);
  if (share >= 1) return 'Đã xem';
  if (share > 0) return `Đang xem dở ${Math.round(share * 100)}%`;
  return 'Chưa xem';
}

/** An uploaded video, playing inside the card, picking up where the child stopped. */
function FilePlayer({ uri, resumeAt, onTime, onEnd }: { uri: string; resumeAt: number; onTime: (sec: number) => void; onEnd: (sec: number) => void }) {
  const resumed = useRef(false);
  const player = useVideoPlayer({ uri }, (p) => {
    p.timeUpdateEventInterval = 5;
    p.play();
  });
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status !== 'readyToPlay' || resumed.current) return;
    resumed.current = true;
    if (resumeAt > 5 && resumeAt < player.duration - 5) player.currentTime = resumeAt;
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => onTime(currentTime));
  useEventListener(player, 'playToEnd', () => onEnd(player.duration));
  // A texture view scrolls with the page on Android; the default surface lags behind it.
  return <VideoView style={StyleSheet.absoluteFill} player={player} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} allowsPictureInPicture={false} surfaceType="textureView" />;
}

/**
 * A YouTube video, embedded right here. The page sits on the website's address
 * so YouTube is told where it is shown (it refuses players that say nothing);
 * its own links — logo, title — open in the browser rather than inside the box.
 */
function YouTubePlayer({ id, onLoad }: { id: string; onLoad: () => void }) {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="https://www.youtube.com/embed/${id}?rel=0&playsinline=1&autoplay=1" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></body></html>`;
  const outside = (url: string) => { WebBrowser.openBrowserAsync(url).catch(() => {}); };
  return (
    <WebView
      source={{ html, baseUrl: `${WEB_ORIGIN}/` }}
      style={s.web}
      originWhitelist={['*']}
      javaScriptEnabled
      allowsInlineMediaPlayback
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction={false}
      scrollEnabled={false}
      bounces={false}
      onLoadEnd={onLoad}
      onOpenWindow={(e) => outside(e.nativeEvent.targetUrl)}
      onShouldStartLoadWithRequest={(req) => {
        if (!req.isTopFrame || req.url.startsWith(WEB_ORIGIN) || req.url.startsWith('about:')) return true;
        outside(req.url);
        return false;
      }}
    />
  );
}

/**
 * A kit's instruction videos, played right in the card: the player on top,
 * starting at the first one not yet finished, the list underneath to switch.
 * Anyone sees how many there are; the videos themselves open once the kit is
 * bought or its code activated.
 */
export function ProductVideos({ productId, signedIn }: { productId: number; signedIn: boolean }) {
  const [videos, setVideos] = useState<VideoItem[] | null>(null);
  const [summary, setSummary] = useState<Array<{ title: string; durationSec: number | null }>>([]);
  const [locked, setLocked] = useState('');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [src, setSrc] = useState('');
  const [srcError, setSrcError] = useState('');
  const lastSent = useRef(0);

  useEffect(() => {
    API.videos.summary(productId).then((d: any) => setSummary(d.items || [])).catch(() => {});
    if (!signedIn) { setLocked('Đăng nhập và mua bộ kit để xem video hướng dẫn.'); return; }
    API.videos.forProduct(productId)
      .then((d: any) => {
        const list: VideoItem[] = d.videos || [];
        setVideos(list);
        setCurrentId((id) => id ?? (list.find((v) => !v.progress?.completedAt) || list[0])?.id ?? null);
      })
      .catch((err: any) => setLocked(err?.message || 'Mua bộ kit để xem video hướng dẫn.'));
  }, [productId, signedIn]);

  // The playable address has its own call: it is checked against the purchase every time.
  useEffect(() => {
    if (!currentId) return;
    let live = true;
    setSrc('');
    setSrcError('');
    API.videos.get(currentId)
      .then((d: any) => live && setSrc(d.video?.url || ''))
      .catch((err: any) => live && setSrcError(err?.message || 'Chưa mở được video này.'));
    return () => { live = false; };
  }, [currentId]);

  const current = videos?.find((v) => v.id === currentId) || null;

  function report(progressSec: number, completed = false) {
    if (!current) return;
    const id = current.id;
    API.videos.progress(id, { progressSec: Math.floor(progressSec), completed }).catch(() => {});
    setVideos((list) => list && list.map((v) => (v.id === id
      ? { ...v, progress: { progressSec: Math.floor(progressSec), completedAt: completed ? new Date().toISOString() : v.progress?.completedAt ?? null } }
      : v)));
  }

  function choose(video: VideoItem) {
    lastSent.current = 0;
    setCurrentId(video.id);
    setStarted(true);
  }

  if (!summary.length && !videos?.length) {
    return locked || videos ? <Text style={s.muted}>Bộ kit này chưa có video hướng dẫn.</Text> : <Loading />;
  }
  if (locked) {
    return (
      <View style={{ gap: 8 }}>
        <View style={s.lock}><Icon name="lock" size={18} color={colors.earth} /><Text style={[s.muted, { flex: 1 }]}>{locked}</Text></View>
        {summary.map((v, i) => (
          <View key={i} style={s.row}>
            <View style={s.num}><Text style={s.numText}>{i + 1}</Text></View>
            <Text style={s.rowTitle}>{v.title}</Text>
            <Text style={s.muted}>{minutes(v.durationSec)}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (!videos || !current) return <Loading />;

  const tube = youTubeId(src || current.externalUrl);
  const poster = current.thumbnailUrl ? mediaUrl(current.thumbnailUrl) : tube ? `https://img.youtube.com/vi/${tube}/hqdefault.jpg` : null;
  const done = videos.filter((v) => v.progress?.completedAt).length;

  return (
    <View style={{ gap: 12 }}>
      <View style={s.stage}>
        {!started ? (
          // Nothing loads until the child presses play.
          <Pressable onPress={() => setStarted(true)} style={s.cover} accessibilityRole="button" accessibilityLabel={`Phát video ${current.title}`}>
            {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <View style={s.shade} />
            <View style={s.bigPlay}><Icon name="play" size={30} color={colors.green} /></View>
            {current.durationSec ? <Text style={s.time}>{minutes(current.durationSec)}</Text> : null}
          </Pressable>
        ) : srcError ? (
          <View style={s.cover}><Text style={s.stageMsg}>{srcError}</Text></View>
        ) : !src ? (
          <View style={s.cover}><ActivityIndicator color={colors.white} /><Text style={s.stageMsg}>Đang mở video…</Text></View>
        ) : tube ? (
          <YouTubePlayer key={current.id} id={tube} onLoad={() => { if (!current.progress?.completedAt) report(0, true); }} />
        ) : current.externalUrl ? (
          // A link YouTube does not serve: only its own site can play it.
          <Pressable onPress={() => WebBrowser.openBrowserAsync(src).catch(() => {})} style={s.cover} accessibilityRole="link">
            <View style={s.bigPlay}><Icon name="play" size={30} color={colors.green} /></View>
            <Text style={s.stageMsg}>Video này mở trên trang gốc — bấm để xem</Text>
          </Pressable>
        ) : (
          <FilePlayer
            key={current.id}
            uri={mediaUrl(src)}
            resumeAt={current.progress?.completedAt ? 0 : current.progress?.progressSec || 0}
            onTime={(t) => {
              if (Math.abs(t - lastSent.current) < 15) return;
              lastSent.current = t;
              report(t);
            }}
            onEnd={(sec) => report(sec || current.durationSec || 0, true)}
          />
        )}
      </View>

      <View style={{ gap: 4 }}>
        <View style={s.nowHead}>
          <Text style={s.nowTitle}>{current.title}</Text>
          <View style={[s.tag, current.progress?.completedAt ? s.tagDone : null]}>
            {current.progress?.completedAt ? <Icon name="check" size={13} color={colors.green} /> : null}
            <Text style={[s.tagText, current.progress?.completedAt ? { color: colors.green } : null]}>{statusOf(current)}</Text>
          </View>
        </View>
        {current.description ? <Text style={s.desc}>{current.description}</Text> : null}
      </View>

      {videos.length > 1 && (
        <View style={{ gap: 8 }}>
          <View style={s.listHead}>
            <Text style={s.listTitle}>{videos.length} video hướng dẫn</Text>
            <Text style={s.muted}>Đã xem {done}/{videos.length}</Text>
          </View>
          {videos.map((v, i) => {
            const on = v.id === current.id;
            const share = watched(v);
            const thumb = v.thumbnailUrl ? mediaUrl(v.thumbnailUrl) : youTubeId(v.externalUrl) ? `https://img.youtube.com/vi/${youTubeId(v.externalUrl)}/default.jpg` : null;
            return (
              <Pressable
                key={v.id}
                onPress={() => choose(v)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [s.row, on && s.rowOn, pressed && { backgroundColor: colors.mint }]}
              >
                <View style={s.thumb}>
                  {thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={s.numText}>{i + 1}</Text>}
                  {on && started ? <View style={s.thumbOn}><Icon name="play" size={16} color={colors.white} /></View> : null}
                  {share > 0 && share < 1 ? <View style={[s.thumbBar, { width: `${share * 100}%` }]} /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[s.rowTitle, on && { color: colors.greenDark }]} numberOfLines={2}>{i + 1}. {v.title}</Text>
                  <Text style={s.rowSub}>{on && started ? 'Đang phát' : statusOf(v)}{v.durationSec ? ` · ${minutes(v.durationSec)}` : ''}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  dark: { flex: 1, backgroundColor: '#000' },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  title: { flex: 1, color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, color: colors.ink3 },
  lock: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: colors.earthSoft },
  stage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, overflow: 'hidden', backgroundColor: '#17241A' },
  web: { flex: 1, backgroundColor: '#000' },
  cover: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16,28,19,0.35)' },
  bigPlay: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  time: { position: 'absolute', right: 10, bottom: 10, overflow: 'hidden', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(16,28,19,0.7)', color: colors.white, fontFamily: fonts.semi, fontSize: 12 },
  stageMsg: { color: colors.white, fontFamily: fonts.semi, fontSize: 14, textAlign: 'center' },
  nowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nowTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  desc: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.ink3 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.canvas },
  tagDone: { backgroundColor: colors.mint, borderColor: colors.mint },
  tagText: { fontFamily: fonts.semi, fontSize: 12, color: colors.ink3 },
  listHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
  listTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, padding: 8, paddingRight: 12, borderRadius: 14, backgroundColor: colors.card, ...shadow.sm },
  rowOn: { borderColor: colors.green, backgroundColor: colors.mint },
  rowTitle: { flex: 1, fontFamily: fonts.semi, fontSize: 14.5, color: colors.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3 },
  thumb: { width: 72, height: 44, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  thumbOn: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(35,107,58,0.6)', alignItems: 'center', justifyContent: 'center' },
  thumbBar: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: colors.green },
  num: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink3 },
});
