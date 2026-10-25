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

function Line({ label, value, copy, strong }: { label: string; value?: string; copy?: string; strong?: boolean }) {
  const toast = useToast();
  return (
    <View style={[s.line, strong && { backgroundColor: colors.warnSoft }]}>
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
    <View style={{ gap: 12 }}>
      <View style={{ alignItems: 'center' }}>
        <T muted>Số tiền cần chuyển</T>
        <Text style={s.amount}>{formatPrice(transfer.amount)}</Text>
      </View>
      <Button title="Mở app ngân hàng để chuyển" icon="card" onPress={() => setPicking(true)} />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Image source={{ uri: transfer.qrUrl }} style={s.qr} contentFit="contain" />
        <T muted style={{ fontSize: 13 }}>Hoặc quét mã này bằng điện thoại khác</T>
      </View>
      <Button title={sharing ? 'Đang chuẩn bị ảnh…' : 'Lưu / gửi ảnh mã QR'} icon="album" variant="soft" busy={sharing} onPress={share} />
      <View style={s.lines}>
        <Line label="Ngân hàng" value={transfer.bankCode} />
        <Line label="Số tài khoản" value={transfer.accountNumber} copy="Đã sao chép số tài khoản" />
        <Line label="Chủ tài khoản" value={transfer.accountName} />
        <Line label="Số tiền" value={String(transfer.amount)} copy="Đã sao chép số tiền" />
        <Line label="Nội dung" value={transfer.memo} copy="Đã sao chép nội dung" strong />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Icon name="warning" size={16} color={colors.warn} />
        <T style={{ flex: 1, color: colors.warn, fontSize: 13 }}>Giữ nguyên nội dung chuyển khoản — sửa hay viết thêm thì hệ thống không nhận ra khoản thanh toán của bạn.</T>
      </View>

      <Sheet open={picking} title="Chọn app ngân hàng" onClose={() => setPicking(false)}>
        <T muted>Số tiền và nội dung được điền sẵn ở các app có dấu “Tự điền”. Với app khác, nội dung đã được sao chép để bạn dán vào.</T>
        {!apps && <T muted>Đang tải danh sách ngân hàng…</T>}
        {apps && apps.length === 0 && <T muted>Chưa tải được danh sách. Hãy mở app ngân hàng và dùng các thông tin bên dưới mã QR.</T>}
        {apps?.map((app) => (
          <Pressable key={app.appId} onPress={() => open(app)} style={({ pressed }) => [s.bank, pressed && { backgroundColor: colors.greenSoft }]}>
            <Image source={{ uri: app.appLogo }} style={s.bankLogo} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={s.bankName}>{app.appName}</Text>
              <Text numberOfLines={1} style={s.bankSub}>{app.bankName}</Text>
            </View>
            {app.autofill ? <View style={s.auto}><Text style={s.autoText}>Tự điền</Text></View> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  amount: { fontFamily: fonts.bold, fontSize: 30, color: colors.price },
  qr: { width: 240, height: 240, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  lines: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, overflow: 'hidden' },
  line: { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingLeft: 12, paddingRight: 4, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 8 },
  lineLabel: { width: 100, fontFamily: fonts.body, fontSize: 13, color: colors.ink4 },
  lineValue: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  copy: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  bank: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, padding: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  bankLogo: { width: 40, height: 40, borderRadius: 10 },
  bankName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  bankSub: { fontFamily: fonts.body, fontSize: 12, color: colors.ink4 },
  auto: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.greenSoft },
  autoText: { fontFamily: fonts.bold, fontSize: 11, color: colors.greenDark },
});
