import { useCallback, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { useAuth } from "../src/AuthContext";
import { radius, spacing } from "../src/theme";
import { useAppTheme } from "../src/ThemeContext";

type ShoppingItem = {
  id: string;
  name: string;
  quantity: number;
  unit?: string | null;
  notes?: string | null;
  is_checked: boolean;
  created_by_name?: string | null;
};

export default function ShoppingList() {
  const { house } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");

  const load = useCallback(async () => {
    if (!house) return;
    setLoading(true);
    try {
      setItems(await api.get<ShoppingItem[]>(`/houses/${house.id}/shopping-items`));
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setLoading(false);
    }
  }, [house]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function addItem() {
    if (!house || name.trim().length < 2) {
      Alert.alert("Atenção", "Digite o nome do item");
      return;
    }
    try {
      await api.post(`/houses/${house.id}/shopping-items`, {
        name: name.trim(),
        quantity: parseFloat(quantity.replace(",", ".")) || 1,
        unit: unit.trim() || null,
      });
      setName("");
      setQuantity("1");
      setUnit("");
      load();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function toggle(item: ShoppingItem) {
    if (!house) return;
    try {
      await api.put(`/houses/${house.id}/shopping-items/${item.id}`, {
        ...item,
        is_checked: !item.is_checked,
      });
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, is_checked: !p.is_checked } : p)));
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function remove(item: ShoppingItem) {
    if (!house) return;
    Alert.alert("Remover item", `Remover ${item.name}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/houses/${house.id}/shopping-items/${item.id}`);
            setItems((prev) => prev.filter((p) => p.id !== item.id));
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
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lista de compras</Text>
        <View style={{ width: 42 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.addCard}>
          <Text style={styles.label}>Item</Text>
          <TextInput
            style={styles.input}
            placeholder="Arroz, leite, sabão..."
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Quantidade</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Unidade</Text>
              <TextInput
                style={styles.input}
                placeholder="un, kg, cx"
                placeholderTextColor={colors.textMuted}
                value={unit}
                onChangeText={setUnit}
              />
            </View>
          </View>
          <TouchableOpacity style={styles.submit} onPress={addItem}>
            <Ionicons name="add" size={18} color={colors.primaryText} />
            <Text style={styles.submitText}>Adicionar</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cart-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum item ainda</Text>
            <Text style={styles.emptyText}>Monte a lista antes de ir ao mercado.</Text>
          </View>
        ) : (
          items.map((item) => (
            <TouchableOpacity key={item.id} style={styles.itemCard} onPress={() => toggle(item)} onLongPress={() => remove(item)}>
              <View style={[styles.check, item.is_checked && styles.checkActive]}>
                {item.is_checked && <Ionicons name="checkmark" size={18} color={colors.primaryText} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, item.is_checked && styles.itemChecked]}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} {item.unit || "un"}{item.created_by_name ? ` • ${item.created_by_name}` : ""}
                </Text>
              </View>
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  content: { padding: spacing.lg, paddingBottom: 120 },
  addCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: "800", marginBottom: 6, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    color: colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  row: { flexDirection: "row", gap: spacing.sm },
  submit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginTop: spacing.md,
  },
  submitText: { color: colors.primaryText, fontWeight: "800" },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "800", marginTop: spacing.md },
  emptyText: { color: colors.textSecondary, marginTop: 4 },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkActive: { backgroundColor: colors.positive, borderColor: colors.positive },
  itemName: { color: colors.textPrimary, fontWeight: "800", fontSize: 15 },
  itemChecked: { color: colors.textMuted, textDecorationLine: "line-through" },
  itemMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
});
