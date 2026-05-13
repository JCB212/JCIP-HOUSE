import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { api } from "../../src/api";
import { useAuth } from "../../src/AuthContext";
import { colors, formatBRL, radius, spacing } from "../../src/theme";

export default function Members() {
  const { house, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!house) return;
    setLoading(true);
    try {
      const d = await api.get<any>(`/houses/${house.id}/dashboard`);
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [house]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function shareCode() {
    if (!house) return;
    const msg = `🏡 Junte-se à casa "${house.name}" no JCIP House Finance!\n\nCódigo de convite: ${house.invite_code}`;
    try {
      await Share.share({ message: msg });
    } catch {}
  }

  async function copyCode() {
    if (!house) return;
    await Clipboard.setStringAsync(house.invite_code);
    Alert.alert("Copiado!", "Código de convite copiado para a área de transferência.");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Moradores</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {/* Invite code */}
        <View style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>Código de convite</Text>
          <Text testID="invite-code-text" style={styles.inviteCode}>{house?.invite_code}</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <TouchableOpacity testID="btn-copy-code" style={styles.inviteBtn} onPress={copyCode}>
              <Ionicons name="copy-outline" size={16} color="#fff" />
              <Text style={styles.inviteBtnText}>Copiar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="btn-share-code"
              style={[styles.inviteBtn, { backgroundColor: colors.positive }]}
              onPress={shareCode}
            >
              <Ionicons name="share-social" size={16} color="#fff" />
              <Text style={styles.inviteBtnText}>Compartilhar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{house?.members.length} moradores</Text>

        {(data?.members_summary || []).map((m: any) => {
          const member = house?.members.find((hm) => hm.user_id === m.user_id);
          return (
            <View key={m.user_id} style={styles.memberCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{m.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.name}>{m.name}</Text>
                  {member?.role === "owner" && (
                    <View style={styles.ownerBadge}>
                      <Text style={styles.ownerBadgeText}>DONO</Text>
                    </View>
                  )}
                  {m.user_id === user?.id && (
                    <View style={[styles.ownerBadge, { backgroundColor: colors.neutralBg }]}>
                      <Text style={[styles.ownerBadgeText, { color: colors.neutral }]}>VOCÊ</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sub}>
                  Peso: {member?.weight || 1} • Pagou no mês:{" "}
                  {formatBRL(m.total_paid, house?.currency)}
                </Text>
                <Text style={styles.sub}>
                  Contribuiu: {formatBRL(m.total_contributed, house?.currency)}
                </Text>
              </View>
              <View
                style={[
                  styles.balance,
                  {
                    backgroundColor:
                      m.balance >= 0 ? colors.positiveBg : colors.debtBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.balanceTxt,
                    { color: m.balance >= 0 ? colors.positive : colors.debt },
                  ]}
                >
                  {m.balance >= 0 ? "+" : ""}
                  {formatBRL(m.balance, house?.currency)}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },
  inviteCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  inviteLabel: { color: "#d6d3d1", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 2 },
  inviteCode: { color: "#fff", fontSize: 36, fontWeight: "900", letterSpacing: 4, marginTop: 6 },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.neutral,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  inviteBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textSecondary, marginBottom: spacing.md, textTransform: "uppercase", letterSpacing: 1 },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutralBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarTxt: { color: colors.neutral, fontWeight: "800", fontSize: 18 },
  name: { fontWeight: "700", color: colors.textPrimary, fontSize: 15 },
  sub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  ownerBadge: {
    backgroundColor: colors.positiveBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  ownerBadgeText: { fontSize: 9, fontWeight: "800", color: colors.positive, letterSpacing: 0.5 },
  balance: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  balanceTxt: { fontWeight: "800", fontSize: 12 },
});
