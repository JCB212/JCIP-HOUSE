import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { useAuth } from "../../src/AuthContext";
import { formatBRL, radius, spacing } from "../../src/theme";
import { useAppTheme } from "../../src/ThemeContext";

type Cat = { id: string; name: string; icon: string; color: string; is_market_style: boolean };
type Item = { name: string; quantity: string; unit_price: string };

export default function NewExpense() {
  const { house, user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [catId, setCatId] = useState<string | null>(null);
  const [payerId, setPayerId] = useState<string | null>(user?.id || null);
  const [expenseType, setExpenseType] = useState<"collective" | "individual">("collective");
  const [splitType, setSplitType] = useState<"equal" | "weight" | "custom">("equal");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!house) return;
    (async () => {
      const c = await api.get<Cat[]>(`/houses/${house.id}/categories`);
      setCats(c);
      const init: Record<string, boolean> = {};
      house.members.forEach((m) => (init[m.user_id] = true));
      setSelected(init);
    })();
  }, [house]);

  const selectedCat = cats.find((c) => c.id === catId);
  const isMarketMode = !!selectedCat?.is_market_style;

  const itemsTotal = items.reduce((s, it) => {
    const q = parseFloat(it.quantity.replace(",", ".")) || 0;
    const p = parseFloat(it.unit_price.replace(",", ".")) || 0;
    return s + q * p;
  }, 0);

  const amountNum = isMarketMode ? itemsTotal : (parseFloat(amount.replace(",", ".")) || 0);
  const participantIds = Object.keys(selected).filter((k) => selected[k]);

  function previewShare(uid: string): number {
    if (expenseType === "individual") return uid === payerId ? amountNum : 0;
    if (!participantIds.includes(uid)) return 0;
    if (splitType === "equal") return amountNum / (participantIds.length || 1);
    if (splitType === "weight") {
      const total = house!.members.filter((m) => participantIds.includes(m.user_id))
        .reduce((s, m) => s + m.weight, 0) || 1;
      const mine = house!.members.find((m) => m.user_id === uid)?.weight || 1;
      return (amountNum * mine) / total;
    }
    return parseFloat((customShares[uid] || "0").replace(",", ".")) || 0;
  }

  function addItem() { setItems([...items, { name: "", quantity: "1", unit_price: "" }]); }
  function updItem(i: number, field: keyof Item, v: string) {
    const u = [...items]; u[i] = { ...u[i], [field]: v }; setItems(u);
  }
  function delItem(i: number) { setItems(items.filter((_, j) => j !== i)); }

  async function submit() {
    if (!description.trim()) { Alert.alert("Atenção", "Informe a descrição"); return; }
    if (!payerId) { Alert.alert("Atenção", "Selecione quem pagou"); return; }
    if (isMarketMode) {
      if (items.length === 0 || itemsTotal <= 0) {
        Alert.alert("Atenção", "Adicione ao menos 1 item"); return;
      }
    } else if (amountNum <= 0) {
      Alert.alert("Atenção", "Informe o valor"); return;
    }

    const participants = expenseType === "individual"
      ? [{ user_id: payerId }]
      : participantIds.map((uid) => ({
          user_id: uid,
          share_amount: splitType === "custom"
            ? parseFloat((customShares[uid] || "0").replace(",", ".")) || 0
            : undefined,
        }));

    const body: any = {
      description: description.trim(),
      payer_id: payerId,
      category_id: catId,
      expense_type: expenseType,
      split_type: expenseType === "individual" ? "individual" : splitType,
      participants,
      notes: notes.trim() || null,
    };

    if (isMarketMode) {
      body.items = items
        .filter((it) => it.name.trim() && it.unit_price)
        .map((it) => ({
          name: it.name.trim(),
          quantity: parseFloat(it.quantity.replace(",", ".")) || 1,
          unit_price: parseFloat(it.unit_price.replace(",", ".")) || 0,
        }));
    } else {
      body.amount = amountNum;
    }

    setLoading(true);
    try {
      await api.post(`/houses/${house!.id}/expenses`, body);
      router.back();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally { setLoading(false); }
  }

  if (!house) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="new-expense-close" onPress={() => router.back()}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Novo gasto</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {/* Category first - triggers market mode */}
          <Text style={styles.label}>Categoria</Text>
          <View style={styles.chipsWrap}>
            {cats.map((c) => (
              <TouchableOpacity key={c.id}
                style={[styles.chip, catId === c.id && { backgroundColor: c.color + "22", borderColor: c.color }]}
                onPress={() => setCatId(c.id)}>
                <Text style={[styles.chipTxt, catId === c.id && { color: c.color, fontWeight: "800" }]}>
                  {c.is_market_style ? "🛒 " : ""}{c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isMarketMode && (
            <View style={styles.marketBanner}>
              <Ionicons name="cart" size={18} color={colors.positive} />
              <Text style={styles.marketTxt}>Modo mercado: liste os itens abaixo e o total é calculado automaticamente</Text>
            </View>
          )}

          {!isMarketMode && (
            <>
              <Text style={styles.label}>Valor</Text>
              <View style={styles.amountWrap}>
                <Text style={styles.currency}>R$</Text>
                <TextInput testID="new-expense-amount" style={styles.amount}
                  placeholder="0,00" placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad" value={amount} onChangeText={setAmount}/>
              </View>
            </>
          )}

          <Text style={styles.label}>Descrição</Text>
          <TextInput testID="new-expense-desc" style={styles.input}
            placeholder={isMarketMode ? "Ex.: Compras da semana" : "Ex.: Conta de luz"}
            placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription}/>

          {/* Items list (market) */}
          {isMarketMode && (
            <>
              <View style={styles.itemsHeader}>
                <Text style={styles.label}>Itens</Text>
                <Text style={styles.totalBadge}>Total: {formatBRL(itemsTotal, house.currency)}</Text>
              </View>
              {items.map((it, i) => (
                <View key={i} style={styles.itemRow}>
                  <TextInput style={[styles.itemInput, { flex: 1.5 }]} placeholder="Item"
                    placeholderTextColor={colors.textMuted} value={it.name}
                    onChangeText={(v) => updItem(i, "name", v)}/>
                  <TextInput style={[styles.itemInput, { width: 50 }]} placeholder="Qtd"
                    placeholderTextColor={colors.textMuted} keyboardType="decimal-pad"
                    value={it.quantity} onChangeText={(v) => updItem(i, "quantity", v)}/>
                  <TextInput style={[styles.itemInput, { width: 80 }]} placeholder="Unit"
                    placeholderTextColor={colors.textMuted} keyboardType="decimal-pad"
                    value={it.unit_price} onChangeText={(v) => updItem(i, "unit_price", v)}/>
                  <TouchableOpacity onPress={() => delItem(i)} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={20} color={colors.debt} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity testID="add-item-btn" style={styles.addItem} onPress={addItem}>
                <Ionicons name="add" size={16} color={colors.neutral}/>
                <Text style={styles.addItemTxt}>Adicionar item</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.label}>Tipo</Text>
          <View style={styles.segRow}>
            {[{ k: "collective", lbl: "Coletivo" }, { k: "individual", lbl: "Individual" }].map((t) => (
              <TouchableOpacity key={t.k} style={[styles.seg, expenseType === t.k && styles.segActive]}
                onPress={() => setExpenseType(t.k as any)}>
                <Text style={[styles.segTxt, expenseType === t.k && styles.segTxtActive]}>{t.lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Quem pagou</Text>
          <View style={styles.chipsWrap}>
            {house.members.map((m) => (
              <TouchableOpacity key={m.user_id}
                style={[styles.chip, payerId === m.user_id && styles.chipActive]}
                onPress={() => setPayerId(m.user_id)}>
                <Text style={[styles.chipTxt, payerId === m.user_id && styles.chipTxtActive]}>{m.name.split(" ")[0]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {expenseType === "collective" && (
            <>
              <Text style={styles.label}>Dividir</Text>
              <View style={styles.segRow}>
                {[{ k: "equal", lbl: "Igual" }, { k: "weight", lbl: "Peso" }, { k: "custom", lbl: "Custom" }].map((t) => (
                  <TouchableOpacity key={t.k} style={[styles.seg, splitType === t.k && styles.segActive]}
                    onPress={() => setSplitType(t.k as any)}>
                    <Text style={[styles.segTxt, splitType === t.k && styles.segTxtActive]}>{t.lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Participantes</Text>
              {house.members.map((m) => {
                const isOn = !!selected[m.user_id];
                const share = previewShare(m.user_id);
                return (
                  <TouchableOpacity key={m.user_id} style={styles.partRow}
                    onPress={() => setSelected({ ...selected, [m.user_id]: !isOn })}>
                    <View style={[styles.checkbox, isOn && styles.checkboxActive]}>
                      {isOn && <Ionicons name="checkmark" size={14} color={colors.primaryText} />}
                    </View>
                    <Text style={{ flex: 1, color: colors.textPrimary, fontWeight: "600" }}>{m.name}</Text>
                    {splitType === "custom" && isOn ? (
                      <TextInput style={styles.customInput} placeholder="0,00"
                        placeholderTextColor={colors.textMuted} keyboardType="decimal-pad"
                        value={customShares[m.user_id] || ""}
                        onChangeText={(v) => setCustomShares({ ...customShares, [m.user_id]: v })}/>
                    ) : (
                      <Text style={styles.shareTxt}>{isOn ? formatBRL(share, house.currency) : "—"}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <Text style={styles.label}>Observações</Text>
          <TextInput style={[styles.input, { height: 70, textAlignVertical: "top" }]}
            placeholder="Anotações..." placeholderTextColor={colors.textMuted}
            value={notes} onChangeText={setNotes} multiline/>

          <TouchableOpacity testID="new-expense-submit"
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            disabled={loading} onPress={submit}>
            {loading ? <ActivityIndicator color={colors.primaryText}/> :
              <Text style={styles.submitTxt}>Adicionar gasto</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: "700", textTransform: "uppercase",
    letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm },
  amountWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border },
  currency: { fontSize: 20, color: colors.textSecondary, fontWeight: "700", marginRight: 8 },
  amount: { fontSize: 36, fontWeight: "900", color: colors.textPrimary, minWidth: 120,
    textAlign: "center", padding: 0 },
  input: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md,
    paddingVertical: 14, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },

  marketBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md,
    backgroundColor: colors.positiveBg, padding: spacing.md, borderRadius: radius.lg },
  marketTxt: { flex: 1, color: colors.positive, fontSize: 12, fontWeight: "600", lineHeight: 16 },

  itemsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    marginTop: spacing.md, marginBottom: spacing.sm },
  totalBadge: { backgroundColor: colors.primary, color: colors.primaryText, paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: radius.pill, fontSize: 12, fontWeight: "800", overflow: "hidden" },
  itemRow: { flexDirection: "row", gap: 6, marginBottom: 6, alignItems: "center" },
  itemInput: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 10,
    paddingVertical: 10, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  addItem: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
    paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.neutral,
    borderStyle: "dashed", marginTop: 4 },
  addItemTxt: { color: colors.neutral, fontWeight: "700", fontSize: 13 },

  segRow: { flexDirection: "row", gap: 4, backgroundColor: colors.borderLight, padding: 4, borderRadius: radius.lg },
  seg: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: "center" },
  segActive: { backgroundColor: colors.surface },
  segTxt: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  segTxtActive: { color: colors.textPrimary },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  chipTxtActive: { color: colors.primaryText },
  partRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    padding: spacing.md, borderRadius: radius.lg, marginBottom: 6, borderWidth: 1,
    borderColor: colors.border, gap: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center" },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  shareTxt: { color: colors.textSecondary, fontWeight: "700", fontSize: 14 },
  customInput: { width: 90, backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 10,
    paddingVertical: 8, fontSize: 14, color: colors.textPrimary, textAlign: "right" },
  submitBtn: { marginTop: spacing.xl, backgroundColor: colors.primary, paddingVertical: 16,
    borderRadius: radius.lg, alignItems: "center" },
  submitTxt: { color: colors.primaryText, fontWeight: "800", fontSize: 16 },
});
