import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { useAuth } from "../../src/AuthContext";
import { formatBRL, radius, spacing } from "../../src/theme";
import { useAppTheme } from "../../src/ThemeContext";

export default function ExpensesTab() {
  const { house } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!house) return;
    setLoading(true);
    try {
      const data = await api.get<any[]>(`/houses/${house.id}/expenses`);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [house]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function del(id: string) {
    Alert.alert("Remover gasto", "Tem certeza?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/houses/${house!.id}/expenses/${id}`);
            load();
          } catch (e: any) {
            Alert.alert("Erro", e.message);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Gastos</Text>
        <TouchableOpacity
          testID="expenses-add-btn"
          style={styles.addBtn}
          onPress={() => router.push("/expense/new")}
        >
          <Ionicons name="add" size={20} color={colors.primaryText} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhum gasto registrado ainda.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onLongPress={() => del(item.id)}
            style={styles.card}
            testID={`expense-item-${item.id}`}
          >
            <View
              style={[
                styles.iconBg,
                { backgroundColor: (item.category_color || colors.neutral) + "22" },
              ]}
            >
              <Ionicons
                name="receipt-outline"
                size={20}
                color={item.category_color || colors.neutral}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.desc}>{item.description}</Text>
              <Text style={styles.meta}>
                {item.payer_name} • {item.category_name || "Sem categoria"}
              </Text>
              <Text style={styles.meta}>{item.expense_date}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.amount}>{formatBRL(item.amount, house?.currency)}</Text>
              <View
                style={[
                  styles.badge,
                  item.expense_type === "collective"
                    ? { backgroundColor: colors.neutralBg }
                    : { backgroundColor: colors.borderLight },
                ]}
              >
                <Text
                  style={{
                    color:
                      item.expense_type === "collective" ? colors.neutral : colors.textSecondary,
                    fontSize: 10,
                    fontWeight: "700",
                  }}
                >
                  {item.expense_type === "collective" ? "COLETIVO" : "INDIVIDUAL"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
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
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  desc: { color: colors.textPrimary, fontWeight: "700" },
  meta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  amount: { color: colors.textPrimary, fontWeight: "800", fontSize: 15 },
  badge: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  empty: { color: colors.textSecondary, textAlign: "center", padding: spacing.xl },
});
