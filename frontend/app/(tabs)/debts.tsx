import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { useAuth } from "../../src/AuthContext";
import { formatBRL, radius, spacing } from "../../src/theme";
import { useAppTheme } from "../../src/ThemeContext";

type Debt = {
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  to_name: string;
  amount: number;
};

export default function Debts() {
  const { house, user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!house) return;
    setLoading(true);
    try {
      const d = await api.get<any>(`/houses/${house.id}/dashboard`);
      setDebts(d.debts || []);
    } finally {
      setLoading(false);
    }
  }, [house]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function settle(d: Debt) {
    Alert.alert(
      "Registrar pagamento",
      `${d.from_name} pagou ${formatBRL(d.amount, house?.currency)} para ${d.to_name}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            try {
              await api.post(`/houses/${house!.id}/payments`, {
                from_user_id: d.from_user_id,
                to_user_id: d.to_user_id,
                amount: d.amount,
                note: "Acerto",
              });
              load();
            } catch (e: any) {
              Alert.alert("Erro", e.message);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Acertos de contas</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={colors.neutral} />
          <Text style={styles.infoText}>
            Calculamos automaticamente o mínimo de transferências para quitar todas as dívidas.
          </Text>
        </View>

        {debts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle" size={48} color={colors.positive} />
            <Text style={styles.emptyTitle}>Tudo certo!</Text>
            <Text style={styles.emptyText}>Ninguém deve para ninguém no momento.</Text>
          </View>
        ) : (
          debts.map((d, i) => {
            const iOwe = d.from_user_id === user?.id;
            const owesMe = d.to_user_id === user?.id;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => settle(d)}
                style={styles.card}
                testID={`debt-item-${i}`}
              >
                <View style={styles.avatarRow}>
                  <View style={[styles.avatar, { backgroundColor: colors.debtBg }]}>
                    <Text style={[styles.avatarText, { color: colors.debt }]}>
                      {d.from_name[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color={colors.textSecondary} />
                  <View style={[styles.avatar, { backgroundColor: colors.positiveBg }]}>
                    <Text style={[styles.avatarText, { color: colors.positive }]}>
                      {d.to_name[0]?.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.debtText}>
                    <Text style={{ fontWeight: "700" }}>{iOwe ? "Você" : d.from_name}</Text>
                    {" deve para "}
                    <Text style={{ fontWeight: "700" }}>
                      {owesMe ? "você" : d.to_name}
                    </Text>
                  </Text>
                  <Text
                    style={[
                      styles.amount,
                      { color: owesMe ? colors.positive : colors.debt },
                    ]}
                  >
                    {formatBRL(d.amount, house?.currency)}
                  </Text>
                </View>
                <View style={styles.settleBtn}>
                  <Text style={styles.settleBtnText}>Quitar</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: { padding: spacing.lg },
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.neutralBg,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  infoText: { flex: 1, color: colors.neutral, fontSize: 13, lineHeight: 18 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800" },
  debtText: { color: colors.textPrimary },
  amount: { fontWeight: "800", fontSize: 17, marginTop: 2 },
  settleBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  settleBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, marginTop: spacing.md },
  emptyText: { color: colors.textSecondary, marginTop: 4 },
});
