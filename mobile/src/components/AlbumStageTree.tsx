import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { Image } from 'expo-image';
import { Icon, type IconName } from './Icon';
import { imageSource } from '@/lib/api';
import { colors, fonts } from '@/theme';

type Branch = { id: string; label: string; icon: IconName; count: number; cover?: string | null; current: boolean };

/** Stages grow from the roots upward, right to left within each pair. */
export function AlbumStageTree({ stages, selected, onSelect }: { stages: Branch[]; selected: string; onSelect: (id: string) => void }) {
  const rows = Math.ceil(stages.length / 2);
  const height = rows * 112 + 112;
  return <View style={[s.tree, { height }]}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 360 ${height}`} preserveAspectRatio="none">
        <Path d={`M42 128 C8 76 61 25 114 39 C146 3 214 12 236 46 C300 16 349 74 322 130 C367 178 345 235 322 265 C357 326 324 392 288 412 C292 ${height - 68} 221 ${height - 56} 178 ${height - 72} C115 ${height - 42} 55 ${height - 98} 66 ${height - 146} C12 366 18 313 38 278 C2 221 12 164 42 128Z`} fill="#EAF0E1" />
        <Path d={`M95 82 C149 43 204 66 225 109 C300 85 330 153 298 200 C325 260 287 304 258 329 C283 394 233 ${height - 112} 175 ${height - 105} C106 ${height - 88} 75 390 93 348 C46 300 67 258 82 226 C43 167 58 111 95 82Z`} fill="#E1EAD6" opacity={0.7} />
        <Ellipse cx="181" cy={height - 40} rx="58" ry="8" fill="#DFE5D4" />
        <Path d={`M157 ${height - 40} C184 ${height - 83} 166 ${height - 134} 176 ${height - 192} C190 ${height - 267} 163 209 178 144 C183 112 183 84 177 57 C197 91 193 126 189 155 C179 216 203 ${height - 262} 189 ${height - 188} C179 ${height - 120} 191 ${height - 69} 208 ${height - 40} Q180 ${height - 53} 157 ${height - 40}`} fill="#9A805F" />
        {stages.map((stage, index) => {
          const left = index % 2 !== 0;
          const y = (rows - 1 - Math.floor(index / 2)) * 112 + (left ? 46 : 62);
          const x = left ? 77 : 283;
          return <G key={stage.id}>
            <Path d={`M183 ${y + 83} C${left ? 155 : 215} ${y + 62} ${left ? 137 : 233} ${y + 25} ${x} ${y} C${left ? 128 : 241} ${y + 12} ${left ? 167 : 202} ${y + 43} 185 ${y + 72}Z`} fill="#9A805F" />
            <Path d={`M${left ? 141 : 221} ${y + 43} Q${left ? 139 : 224} ${y + 8} ${left ? 151 : 211} ${y - 10}`} fill="none" stroke="#9A805F" strokeWidth="2" strokeLinecap="round" />
            <G transform={`translate(${left ? 146 : 216} ${y + 9}) scale(${left ? 1 : -1} 1)`}>
              <Path d="M0 0 C-23 -1 -29 -18 -23 -30 C-6 -28 3 -16 0 0Z" fill="#91AA79" />
              <Path d="M1 11 C18 10 28 -3 24 -17 C8 -16 -1 -4 1 11Z" fill="#B0C39A" />
              <Path d="M-1 -2 L-17 -23 M3 7 L19 -10" stroke="#718D60" strokeWidth="0.8" fill="none" />
            </G>
          </G>;
        })}
        <Path d={`M178 ${height - 65} C186 ${height - 119} 175 ${height - 142} 183 ${height - 191} M184 327 Q177 286 181 251`} fill="none" stroke="#C3AD8D" strokeWidth="2" strokeLinecap="round" />
        <Path d="M180 67 C155 58 151 35 162 24 C180 31 187 50 180 67Z" fill="#91AA79" />
        <Path d="M184 83 C205 79 216 62 211 47 C190 51 182 66 184 83Z" fill="#B0C39A" />
        <Path d="M178 60 L165 33 M187 77 L206 54" stroke="#718D60" strokeWidth="1" />
        <Path d={`M133 ${height - 42} Q128 ${height - 54} 119 ${height - 55} M137 ${height - 42} Q141 ${height - 55} 148 ${height - 56} M224 ${height - 43} Q229 ${height - 57} 237 ${height - 59}`} fill="none" stroke="#A0B78B" strokeWidth="2" strokeLinecap="round" />
      </Svg>
    </View>
    {stages.map((stage, index) => <Pressable key={stage.id} onPress={() => onSelect(stage.id)} accessibilityRole="button"
      accessibilityLabel={`${stage.label}, ${stage.count} khoảnh khắc${stage.current ? ', chặng hiện tại' : ''}. Xem và thêm ảnh`}
      accessibilityState={{ selected: selected === stage.id }}
      style={({ pressed }) => [s.node, { top: (rows - 1 - Math.floor(index / 2)) * 112 + (index % 2 !== 0 ? 12 : 28), left: index % 2 !== 0 ? '2%' : '58%' }, pressed && { opacity: 0.7 }]}>
      <View style={[s.medallion, stage.current && s.current, selected === stage.id && s.selected]}>
        {stage.cover ? <Image source={imageSource(stage.cover)} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" /> : <Icon name={stage.icon} size={24} color={colors.greenDark} />}
        <View style={s.number}><Text style={s.numberText}>{index + 1}</Text></View>
      </View>
      <Text style={s.label}>{stage.label}</Text>
      <Text style={s.count}>{stage.count ? `${stage.count} kỷ niệm` : '+ Thêm ảnh'}</Text>
      {stage.current && <Text style={s.currentText}>Hiện tại</Text>}
    </Pressable>)}
    <Text style={s.root}>BẮT ĐẦU TỪ MỘT HẠT NHỎ</Text>
  </View>;
}

const s = StyleSheet.create({
  tree: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#F7F7EF', borderRadius: 24, overflow: 'hidden' },
  node: { position: 'absolute', width: '40%', minHeight: 96, alignItems: 'center', gap: 2 },
  medallion: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#FCFCF6', borderWidth: 1.5, borderColor: '#CCD8BC', alignItems: 'center', justifyContent: 'center' },
  current: { borderColor: '#829B6D', borderWidth: 2 },
  selected: { borderColor: colors.greenDark, borderWidth: 2.5 },
  number: { position: 'absolute', right: -3, bottom: -1, width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#CAD6BD', backgroundColor: '#F9FAF3', alignItems: 'center', justifyContent: 'center' },
  numberText: { fontFamily: fonts.semi, fontSize: 10, color: colors.greenDark },
  label: { fontFamily: fonts.bold, fontSize: 13, textAlign: 'center', color: colors.ink, paddingHorizontal: 5 },
  count: { fontFamily: fonts.medium, fontSize: 11, color: colors.greenDark, paddingHorizontal: 5 },
  currentText: { fontFamily: fonts.semi, fontSize: 9, color: colors.earth },
  root: { position: 'absolute', bottom: 8, width: '100%', textAlign: 'center', fontFamily: fonts.semi, fontSize: 9, letterSpacing: 1, color: colors.earth },
});
