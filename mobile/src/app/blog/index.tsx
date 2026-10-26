import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Button, Empty, ErrorNote, IconButton, Loading, Screen } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { BlogPost } from '@/lib/types';
import { colors, fonts, radius } from '@/theme';

const PER_PAGE = 8;

const open = (post: BlogPost) => () => router.push(`/blog/${post.slug}`);
const dateOf = (post: BlogPost) => formatDate(post.publishedAt || post.createdAt);

/** The cover, or a quiet tile with a book when a post has none. */
function Cover({ post, style, iconSize = 22 }: { post: BlogPost; style: object; iconSize?: number }) {
  const source = imageSource(post.coverUrl);
  return (
    <View style={[s.cover, style]}>
      {source ? <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        : <Icon name="book" size={iconSize} color={colors.green} />}
    </View>
  );
}

/** The newest post, large, at the top of the list. */
function Featured({ post }: { post: BlogPost }) {
  return (
    <Pressable onPress={open(post)} accessibilityRole="button" style={({ pressed }) => [s.featured, pressed && { opacity: 0.92 }]}>
      {post.coverUrl ? <Cover post={post} style={s.featuredCover} /> : null}
      <View style={s.featuredBody}>
        <Text style={s.kicker}>MỚI NHẤT</Text>
        <Text numberOfLines={3} style={s.featuredTitle}>{post.title}</Text>
        {post.excerpt ? <Text numberOfLines={2} style={s.excerpt}>{post.excerpt}</Text> : null}
        <View style={s.metaRow}>
          <Text style={s.date}>{dateOf(post)}</Text>
          <View style={s.readMore}><Text style={s.readMoreText}>Đọc bài</Text><Icon name="arrow-right" size={14} color={colors.green} /></View>
        </View>
      </View>
    </Pressable>
  );
}

/** Every other post: a small picture and two lines, in one list. */
function PostRow({ post, last }: { post: BlogPost; last: boolean }) {
  return (
    <Pressable onPress={open(post)} accessibilityRole="button" style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.cream2 }]}>
      <Cover post={post} style={s.thumb} />
      <View style={[s.rowBody, !last && s.rowDivider]}>
        <Text numberOfLines={2} style={s.rowTitle}>{post.title}</Text>
        {post.excerpt ? <Text numberOfLines={2} style={s.rowExcerpt}>{post.excerpt}</Text> : null}
        <Text style={s.date}>{dateOf(post)}</Text>
      </View>
    </Pressable>
  );
}

/** Góc chia sẻ: Sprouty's articles on growing things with children. */
export default function Blog() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (nextPage = 1) => {
    setLoading(true);
    try {
      const data = await API.blog.list({ page: nextPage, limit: PER_PAGE, ...(search ? { search } : {}) });
      setPosts((list) => (nextPage === 1 ? data.posts || [] : [...list, ...(data.posts || [])]));
      setTotal(data.total || 0);
      setPage(nextPage);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Không tải được bài viết.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { void load(1); }, [load]);

  // A search shows plain results; otherwise the newest post leads.
  const featured = !search ? posts[0] : undefined;
  const rest = featured ? posts.slice(1) : posts;

  return (
    <Screen title="Góc chia sẻ" back="/" onRefresh={() => load(1)}>
      <View style={s.search}>
        <Icon name="search" size={18} color={colors.ink4} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Tìm bài viết…" placeholderTextColor={colors.ink5} style={s.searchInput}
          returnKeyType="search" onSubmitEditing={() => setSearch(query.trim())} accessibilityLabel="Tìm bài viết" />
        {query ? <IconButton icon="close" label="Xoá tìm kiếm" onPress={() => { setQuery(''); setSearch(''); }} /> : null}
      </View>

      {search ? <Text style={s.resultNote}>{total} bài viết cho “{search}”</Text> : null}
      {error ? <ErrorNote message={error} onRetry={() => load(1)} /> : null}
      {loading && !posts.length && <Loading />}
      {!loading && !error && posts.length === 0 && (
        <Empty icon="book" title={search ? 'Không có bài viết phù hợp' : 'Chưa có bài viết'} text={search ? 'Thử một từ khoá khác nhé.' : 'Sprouty sẽ sớm chia sẻ thêm.'} />
      )}

      {featured && <Featured post={featured} />}

      {rest.length > 0 && (
        <View style={{ gap: 8 }}>
          {featured && <Text style={s.sectionTitle}>Bài viết khác</Text>}
          <View style={s.list}>
            {rest.map((post, i) => <PostRow key={post.id} post={post} last={i === rest.length - 1} />)}
          </View>
        </View>
      )}

      {posts.length < total && <Button variant="ghost" title={loading ? 'Đang tải…' : 'Xem thêm bài viết'} busy={loading} onPress={() => load(page + 1)} />}
    </Screen>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingLeft: 14, paddingRight: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, paddingVertical: 8 },
  resultNote: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink3 },
  cover: { backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  featured: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  featuredCover: { width: '100%', aspectRatio: 16 / 9 },
  featuredBody: { padding: 16, gap: 6 },
  kicker: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1, color: colors.green },
  featuredTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: colors.ink },
  excerpt: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  date: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink4 },
  readMore: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readMoreText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.green },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.ink4, marginLeft: 4 },
  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 12, paddingTop: 12 },
  thumb: { width: 84, height: 84, borderRadius: 12 },
  rowBody: { flex: 1, gap: 3, paddingRight: 12, paddingBottom: 12, minHeight: 96 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, color: colors.ink },
  rowExcerpt: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink3 },
});
