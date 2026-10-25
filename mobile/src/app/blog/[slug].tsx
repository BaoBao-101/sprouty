import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { ErrorNote, H, IconButton, Loading, Screen, SectionHead, T } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { API_ORIGIN, WEB_ORIGIN } from '@/lib/config';
import { formatDate, formatPrice } from '@/lib/format';
import { openUrl } from '@/lib/help';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, radius } from '@/theme';

interface Recommended { id: number; name: string; images?: string[]; price: number }
interface Post { title: string; slug?: string; coverUrl?: string; contentHtml: string; publishedAt?: string | null; createdAt?: string; author?: { name: string } | null; recommendedProducts?: Recommended[] }

/** The article's HTML in the app's type and colours; it measures itself so the page scrolls as one. */
function articleDocument(html: string) {
  // Uploaded pictures live on the API host; everything else is relative to the website.
  const body = html.replace(/(src|href)="\/uploads\//g, `$1="${API_ORIGIN}/uploads/`);
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
  html,body{margin:0;padding:0;background:${colors.cream};color:${colors.ink2};font:16px/1.65 -apple-system,Roboto,"Segoe UI",sans-serif;overflow-wrap:anywhere}
  h1,h2,h3{color:${colors.ink};line-height:1.3;margin:1.2em 0 .5em} h2{font-size:1.25em} h3{font-size:1.1em}
  p,ul,ol{margin:0 0 1em} img,video,iframe{max-width:100%;height:auto;border-radius:14px} a{color:${colors.green};font-weight:600}
  blockquote{margin:1em 0;padding:.6em 1em;border-left:4px solid ${colors.greenLight};background:${colors.greenSoft};border-radius:8px}
  table{display:block;overflow-x:auto;border-collapse:collapse} td,th{border:1px solid ${colors.line};padding:6px 8px}
</style></head><body>${body}
<script>
  function send(){window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight))}
  window.addEventListener('load',send); new ResizeObserver(send).observe(document.body); setTimeout(send,300);
</script></body></html>`;
}

export default function BlogPostScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const [height, setHeight] = useState(400);
  const post = useLoad(async () => (await API.blog.get(String(slug))).post as Post, [slug]);
  const html = useMemo(() => (post.data ? articleDocument(post.data.contentHtml || '') : ''), [post.data]);

  // Links in the article: a kit opens in the app, anything else in the browser.
  function onNavigate(req: WebViewNavigation) {
    // The document itself loads at the base URL; only a tapped link is intercepted.
    const own = req.url.startsWith('about:') || req.url.startsWith('data:') || req.url.replace(/\/$/, '') === WEB_ORIGIN;
    const tapped = Platform.OS === 'ios' ? req.navigationType === 'click' : !own;
    if (!tapped) return true;
    const kit = req.url.match(/\/shop\/(\d+)/);
    if (kit) router.push(`/product/${kit[1]}`);
    else if (/^https?:/.test(req.url)) void openUrl(req.url);
    return false;
  }

  const data = post.data;
  return (
    <Screen title="Góc chia sẻ" back="/blog" onRefresh={post.reload}
      actions={data ? <IconButton icon="share" label="Chia sẻ bài viết" onPress={() => Share.share({ message: `${data.title}\n${WEB_ORIGIN}/blog/${slug}` })} /> : undefined}>
      {post.loading && !data && <Loading label="Đang tải bài viết…" />}
      {post.error ? <ErrorNote message={post.error} onRetry={post.reload} /> : null}
      {data && (
        <>
          <H size={25}>{data.title}</H>
          <T muted>{formatDate(data.publishedAt || data.createdAt)}{data.author?.name ? ` · ${data.author.name}` : ''}</T>
          {imageSource(data.coverUrl) && <Image source={imageSource(data.coverUrl)} style={s.cover} contentFit="cover" />}
          <View style={{ height }}>
            <WebView originWhitelist={['*']} source={{ html, baseUrl: WEB_ORIGIN }} scrollEnabled={false} style={{ backgroundColor: 'transparent' }}
              onMessage={(e) => { const h = Number(e.nativeEvent.data); if (h > 0) setHeight(Math.ceil(h) + 8); }}
              onShouldStartLoadWithRequest={onNavigate} setSupportMultipleWindows={false} />
          </View>
          {(data.recommendedProducts || []).filter(Boolean).length > 0 && (
            <>
              <SectionHead title="Bộ kit nhắc tới trong bài" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {data.recommendedProducts!.filter(Boolean).map((p) => (
                  <Pressable key={p.id} onPress={() => router.push(`/product/${p.id}`)} style={s.kit}>
                    <View style={s.kitImage}>{imageSource(p.images?.[0]) && <Image source={imageSource(p.images?.[0])} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>
                    <Text numberOfLines={2} style={s.kitName}>{p.name}</Text>
                    <Text style={s.kitPrice}>{formatPrice(Number(p.price))}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg },
  kit: { width: 160, padding: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, gap: 4 },
  kitImage: { height: 110, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.greenSoft },
  kitName: { fontFamily: fonts.semi, fontSize: 13.5, color: colors.ink },
  kitPrice: { fontFamily: fonts.bold, fontSize: 14, color: colors.price },
});
