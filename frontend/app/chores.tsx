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
import { scheduleLocalReminder } from "../src/notifications";

type ChoreAssignment = {
  user_id: string;
  user_name: string;
  status: string;
  completed_at?: string | null;
};

type Chore = {
  id: string;
  title: string;
  description?: string | null;
  due_at?: string | null;
  recurrence: string;
  status: string;
  assignments: ChoreAssignment[];
};

export default function Chores() {
  const { house, user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const [items, setItems] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const currentMember = house?.members.find((m) => m.user_id === user?.id);
  const canManage = house?.owner_id === user?.id || currentMember?.permissions?.manage_chores === true;

  const load = useCallback(async () => {
    if (!house) return;
    setLoading(true);
    try {
      setItems(await api.get<Chore[]>(`/houses/${house.id}/chores`));
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setLoading(false);
    }
  }, [house]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function toggleUser(userId: string) {
    setSelected((prev) => ({ ...prev, [userId]: !prev[userId] }));
  }

  async function addChore() {
    if (!house) return;
    const assignee_user_ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (!title.trim() || assignee_user_ids.length === 0) {
      Alert.alert("Atenção", "Informe o afazer e pelo menos um responsável");
      return;
    }
    try {
      await api.post(`/houses/${house.id}/chores`, {
        title: title.trim(),
        description: description.trim() || null,
        due_at: dueAt.trim() || null,
        recurrence: "none",
        assignee_user_ids,
      });
      await scheduleLocalReminder("Afazer da casa", title.trim(), dueAt.trim() || null).catch(() => undefined);
      setTitle("");
      setDescription("");
      setDueAt("");
      setSelected({});
      load();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function complete(chore: Chore) {
    if (!house) return;
    try {
      await api.post(`/houses/${house.id}/chores/${chore.id}/complete`);
      load();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function remove(chore: Chore) {
    if (!house) return;
    Alert.alert("Remover afazer", `Remover ${chore.title}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/houses/${house.id}/chores/${chore.id}`);
            setItems((prev) => prev.filter((p) => p.id !== chore.id));
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
        <Text style={styles.headerTitle}>Afazeres</Text>
        <View style={{ width: 42 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        {canManage && (
          <View style={styles.form}>
            <Text style={styles.label}>Afazer</Text>
            <TextInput style={styles.input} placeholder="Ex.: lavar pratos" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />
            <Text style={styles.label}>Detalhes</Text>
            <TextInput style={styles.input} placeholder="Opcional" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} />
            <Text style={styles.label}>Dia e hora</Text>
            <TextInput style={styles.input} placeholder="AAAA-MM-DD HH:MM" placeholderTextColor={colors.textMuted} value={dueAt} onChangeText={setDueAt} />
            <Text style={styles.label}>Responsáveis</Text>
            <View style={styles.chips}>
              {house?.members.map((m) => (
                <TouchableOpacity key={m.user_id} style={[styles.chip, selected[m.user_id] && styles.chipActive]} onPress={() => toggleUser(m.user_id)}>
                  <Text style={[styles.chipText, selected[m.user_id] && styles.chipTextActive]}>{m.name.split(" ")[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submit} onPress={addChore}>
              <Ionicons name="add" size={18} color={colors.primaryText} />
              <Text style={styles.submitText}>Criar afazer</Text>
            </TouchableOpacity>
          </View>
        )}

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkbox-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum afazer</Text>
            <Text style={styles.emptyText}>Organize tarefas da casa com responsáveis e horários.</Text>
          </View>
        ) : (
          items.map((item) => {
            const mine = item.assignments.some((a) => a.user_id === user?.id);
            const done = item.status === "done";
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.choreCard, done && { opacity: 0.7 }]}
                onPress={() => (mine || canManage ? complete(item) : undefined)}
                onLongPress={() => (canManage ? remove(item) : undefined)}
              >
                <View style={[styles.choreIcon, done && styles.choreIconDone]}>
                  <Ionicons name={done ? "checkmark" : "time-outline"} size={20} color={done ? colors.primaryText : colors.neutral} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.choreTitle}>{item.title}</Text>
                  {!!item.description && <Text style={styles.choreSub}>{item.description}</Text>}
                  <Text style={styles.choreSub}>
                    {item.due_at || "Sem horário"} • {item.assignments.map((a) => a.user_name.split(" ")[0]).join(", ")}
                  </Text>
                  {item.assignments.some((a) => a.completed_at) && (
                    <Text style={styles.doneText}>
                      Feito em {item.assignments.find((a) => a.completed_at)?.completed_at}
                    </Text>
                  )}
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
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: "800", marginTop: spacing.sm, marginBottom: 6 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: "800" },
  chipTextActive: { color: colors.primaryText },
  submit: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginTop: spacing.md,
  },
  submitText: { color: colors.primaryText, fontWeight: "900" },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "800", marginTop: spacing.md },
  emptyText: { color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  choreCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  choreIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.neutralBg, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  choreIconDone: { backgroundColor: colors.positive },
  choreTitle: { color: colors.textPrimary, fontWeight: "900" },
  choreSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  doneText: { color: colors.positive, fontSize: 11, fontWeight: "800", marginTop: 3 },
});
