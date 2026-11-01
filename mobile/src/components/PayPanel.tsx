import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { bankApps, openBankApp, shareQrImage, type BankApp } from '@/lib/bank';
import { formatPrice } from '@/lib/format';
import type { Transfer } from '@/lib/types';
import { colors, fonts, radius } from '@/theme';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { Button, Sheet, T } from './ui';

function Line({ label, value, copy, strong, last }: { label: string; value?: string; copy?: string; strong?: boolean; last?: boolean }) {
  const toast = useToast();
  return (
    <View style={[s.line, !last && s.divider, strong && { backgroundColor: colors.warnSoft }]}>
      <Text style={s.lineLabel}>{label}</Text>
      <Text selectable style={s.lineValue}>{value || '—'}</Text>
      {copy && value ? (
        <Pressable hitSlop={6} style={s.copy} accessibilityLabel={`Sao chép ${label.toLowerCase()}`}
          onPress={async () => { await Clipboard.setStringAsync(value); toast(copy, 'success'); }}>
          <Icon name="copy" size={18} color={colors.greenDark} />
        </Pressable>
      ) : <View style={{ width: 40 }} />}
    </View>
  );
}

/**
 * Paying a transfer from the phone it is shown on. The first button opens the
 * parent's banking app with everything filled in; the QR code stays below for
 * paying from another phone or scanning a saved picture. The transfer note
 * gets the loudest warning: changed by hand, the money cannot be matched.
 */
export function PayPanel({ transfer, returnPath }: { transfer: Transfer; returnPath: string }) {
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const [apps, setApps] = useState<BankApp[] | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (picking && !apps) bankApps().then(setApps).catch(() => setApps([]));
  }, [picking, apps]);

  async function open(app: BankApp) {
    setPicking(false);
    // Not every banking app fills the note from the link; it is on the clipboard too.
    if (transfer.memo) await Clipboard.setStringAsync(transfer.memo);
    if (!app.autofill) toast('Đã sao chép nội dung chuyển khoản — dán vào ô nội dung nhé.', 'success');
    try {
      await openBankApp(app, transfer, returnPath);
    } catch {
      toast('Chưa mở được app ngân hàng này. Bạn hãy mở app và quét mã QR đã lưu nhé.', 'error');
    }
  }

  async function share() {
    setSharing(true);
    try {
      await shareQrImage(transfer);
    } catch {
      toast('Chưa lưu được ảnh QR. Bạn có thể chụp màn hình mã QR.', 'error');
    } finally {
      setSharing(false);
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={s.amountLabel}>Số tiền cần chuyển</Text>
        <Text style={s.amount}>{formatPrice(transfer.amount)}</Text>
      </View>
      <Button title="Mở app ngân hàng" icon="card" onPress={() => setPicking(true)} />
      <View style={s.qrWrap}>
        <Image source={{ uri: transfer.qrUrl }} style={s.qr} contentFit="contain" />
        <Text style={s.qrHint}>Hoặc quét bằng điện thoại khác</Text>
        <Button small variant="soft" title={sharing ? 'Đang chuẩn bị ảnh…' : 'Lưu ảnh QR'} icon="album" busy={sharing} onPress={share} />
      </View>
      <View style={s.lines}>
        <Line label="Ngân hàng" value={transfer.bankCode} />
        <Line label="Số tài khoản" value={transfer.accountNumber} copy="Đã sao chép số tài khoản" />
        <Line label="Chủ tài khoản" value={transfer.accountName} />
        <Line label="Số tiền" value={String(transfer.amount)} copy="Đã sao chép số tiền" />
        <Line label="Nội dung" value={transfer.memo} copy="Đã sao chép nội dung" strong last />
      </View>
      <View style={s.warn}>
        <Icon name="warning" size={16} color={colors.warn} />
        <Text style={s.warnText}>Giữ nguyên nội dung chuyển khoản để được xác nhận tự động</Text>
      </View>

      <Sheet open={picking} title="Chọn app ngân hàng" onClose={() => setPicking(false)}>
        <View style={s.autoNote}><View style={s.auto}><Text style={s.autoText}>Tự điền</Text></View><Text style={s.autoNoteText}>điền sẵn số tiền và nội dung</Text></View>
        {!apps && <T muted>Đang tải danh sách ngân hàng…</T>}
        {apps && apps.length === 0 && <T muted>Chưa tải được danh sách. Hãy mở app ngân hàng và dùng thông tin bên dưới mã QR.</T>}
        {apps && apps.length > 0 && (
          <View style={s.banks}>
            {apps.map((app, i) => (
              <Pressable key={app.appId} onPress={() => open(app)} style={({ pressed }) => [s.bank, i < apps.length - 1 && s.divider, pressed && { backgroundColor: colors.canvas }]}>
                <Image source={{ uri: app.appLogo }} style={s.bankLogo} contentFit="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={s.bankName}>{app.appName}</Text>
                  <Text numberOfLines={1} style={s.bankSub}>{app.bankName}</Text>
                </View>
                {app.autofill ? <View style={s.auto}><Text style={s.autoText}>Tự điền</Text></View> : null}
              </Pressable>
            ))}
          </View>
        )}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  amountLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3 },
  amount: { fontFamily: fonts.display, fontSize: 34, lineHeight: 42, color: colors.price },
  qrWrap: { alignItems: 'center', gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: colors.canvas },
  qr: { width: 220, height: 220, borderRadius: radius.md, backgroundColor: colors.white },
  qrHint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink3 },
  lines: { borderRadius: radius.md, backgroundColor: colors.canvas, overflow: 'hidden' },
  line: { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingLeft: 14, paddingRight: 4, gap: 8 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  lineLabel: { width: 96, fontFamily: fonts.body, fontSize: 13, color: colors.ink4 },
  lineValue: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  copy: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.warnSoft },
  warnText: { flex: 1, fontFamily: fonts.semi, fontSize: 12.5, lineHeight: 17, color: colors.warn },
  autoNote: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  autoNoteText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3 },
  banks: { borderRadius: radius.lg, backgroundColor: colors.card, overflow: 'hidden' },
  bank: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingHorizontal: 14, paddingVertical: 8 },
  bankLogo: { width: 40, height: 40, borderRadius: 10 },
  bankName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  bankSub: { fontFamily: fonts.body, fontSize: 12, color: colors.ink4 },
  auto: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.mint },
  autoText: { fontFamily: fonts.bold, fontSize: 11, color: colors.greenDark },
});
