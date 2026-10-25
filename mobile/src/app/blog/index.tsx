import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Button, Empty, ErrorNote, IconButton, Loading, Screen, T } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { BlogPost } from '@/lib/types';
import { colors, fonts, radius } from '@/theme';

const PER_PAGE = 8;

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

  return (
    <Screen title="Góc chia sẻ" back="/" onRefresh={() => load(1)}>
      <View style={s.search}>
        <Icon name="search" size={19} color={colors.ink4} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Tìm bài viết…" placeholderTextColor={colors.ink5} style={s.searchInput}
          returnKeyType="search" onSubmitEditing={() => setSearch(query.trim())} accessibilityLabel="Tìm bài viết" />
        {query ? <IconButton icon="close" label="Xoá tìm kiếm" onPress={() => { setQuery(''); setSearch(''); }} /> : null}
      </View>
      {search ? <T muted>{total} bài viết cho “{search}”</T> : null}
      {error ? <ErrorNote message={error} onRetry={() => load(1)} /> : null}
      {loading && !posts.length && <Loading />}
      {!loading && !error && posts.length === 0 && (
        <Empty icon="book" title={search ? 'Không có bài viết phù hợp' : 'Chưa có bài viết'} text={search ? 'Thử một từ khoá khác nhé.' : 'Sprouty sẽ sớm chia sẻ thêm.'} />
      )}
      {posts.map((post, i) => (
        <Pressable key={post.id} onPress={() => router.push(`/blog/${post.slug}`)} style={({ pressed }) => [s.card, i === 0 && !search && s.lead, pressed && { opacity: 0.9 }]}>
          <View style={[s.cover, i === 0 && !search && { height: 190 }]}>
            {imageSource(post.coverUrl) ? <Image source={imageSource(post.coverUrl)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              : <Icon name="book" size={30} color={colors.greenDark} />}
          </View>
          <View style={{ padding: 14, gap: 6 }}>
            <Text numberOfLines={3} style={s.title}>{post.title}</Text>
            {post.excerpt ? <T muted numberOfLines={3}>{post.excerpt}</T> : null}
            <T muted style={{ fontSize: 12.5 }}>{formatDate(post.publishedAt || post.createdAt)}</T>
          </View>
        </Pressable>
      ))}
      {posts.length < total && <Button variant="ghost" title={loading ? 'Đang tải…' : 'Xem thêm bài viết'} busy={loading} onPress={() => load(page + 1)} />}
    </Screen>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, paddingLeft: 14, paddingRight: 4, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15.5, color: colors.ink, paddingVertical: 10 },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  lead: { borderColor: '#CFE9C9' },
  cover: { height: 150, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 18.5, lineHeight: 24, color: colors.ink },
});
