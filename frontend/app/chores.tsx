import { useCallback, useMemo, useState } from "react";
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
import { useFocusEffect, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { useAuth } from "../src/AuthContext";
import { formatDateBR, formatDateTimeBR, radius, spacing, todayISODate } from "../src/theme";
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

const WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const TIME_SLOTS = ["06:00", "08:00", "12:00", "18:00", "21:00"];
const RECURRENCE_OPTIONS = [
  { value: "none", label: "Uma vez" },
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
  { value: "custom", label: "Personalizado" },
];
const SUGGESTIONS = [
  { title: "Lavar pratos", description: "Manter a pia limpa depois das refeições.", recurrence: "daily", time: "21:00", times: "2" },
  { title: "Tirar lixo", description: "Separar lixo comum e reciclável.", recurrence: "daily", time: "20:00", times: "1" },
  { title: "Limpar banheiro", description: "Limpeza completa do banheiro.", recurrence: "weekly", time: "09:00", times: "1" },
  { title: "Organizar sala", description: "Guardar objetos e deixar a sala pronta para uso.", recurrence: "weekly", time: "18:00", times: "1" },
  { title: "Comprar água", description: "Verificar galão, filtro ou garrafas.", recurrence: "biweekly", time: "10:00", times: "1" },
  { title: "Conferir contas", description: "Olhar contas da casa e vencimentos.", recurrence: "monthly", time: "19:00", times: "1" },
];

function firstName(name?: string) {
  return String(name || "").split(" ")[0] || "Morador";
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function recurrencePayload(mode: string, timesPerDay: string, interval: string, unit: string) {
  if (mode === "daily") {
    const times = Math.max(1, Math.min(Number(timesPerDay) || 1, 12));
    return times > 1 ? `daily:${times}` : "daily";
  }
  if (mode === "custom") {
    const safeInterval = Math.max(1, Math.min(Number(interval) || 1, 365));
    return `every:${safeInterval}:${unit}`;
  }
  return mode;
}

function recurrenceLabel(value?: string | null) {
  const raw = String(value || "none");
  const parts = raw.split(":");
  if (raw === "none") return "Nao repete";
  if (parts[0] === "daily") {
    const times = Number(parts[1] || 1);
    return times > 1 ? `${times} vezes por dia` : "Todo dia";
  }
  if (parts[0] === "weekly") return "Toda semana";
  if (parts[0] === "biweekly") return "A cada 15 dias";
  if (parts[0] === "monthly") return "Todo mes";
  if (parts[0] === "every") {
    const unitLabel = parts[2] === "weeks" ? "semana(s)" : parts[2] === "months" ? "mes(es)" : "dia(s)";
    return `A cada ${parts[1] || 1} ${unitLabel}`;
  }
  return raw;
}

export default function Chores() {
  const { house, user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const pathname = usePathname();
  const openedFromTab = pathname === "/house-tasks";
  const [items, setItems] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(todayISODate());
  const [dueTime, setDueTime] = useState("08:00");
  const [hasDueAt, setHasDueAt] = useState(true);
  const [recurrence, setRecurrence] = useState("none");
  const [timesPerDay, setTimesPerDay] = useState("1");
  const [customInterval, setCustomInterval] = useState("2");
  const [customUnit, setCustomUnit] = useState("days");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const currentMember = house?.members.find((m) => m.user_id === user?.id);
  const canManage = house?.owner_id === user?.id || currentMember?.permissions?.manage_chores === true;
  const selectedDueAt = hasDueAt ? `${dueDate} ${dueTime}:00` : null;

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const blanks = new Date(year, month, 1).getDay();
    const total = daysInMonth(year, month);
    return [
      ...Array.from({ length: blanks }, (_, i) => ({ key: `blank-${i}`, day: 0, date: "" })),
      ...Array.from({ length: total }, (_, i) => {
        const day = i + 1;
        return { key: String(day), day, date: isoDate(year, month, day) };
      }),
    ];
  }, [calendarMonth]);

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

  function applySuggestion(item: typeof SUGGESTIONS[number]) {
    setTitle(item.title);
    setDescription(item.description);
    setRecurrence(item.recurrence);
    setDueTime(item.time);
    setTimesPerDay(item.times);
    setHasDueAt(true);
  }

  function moveCalendar(months: number) {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + months, 1));
  }

  async function addChore() {
    if (!house) return;
    const assignee_user_ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (!title.trim()) {
      Alert.alert("Atenção", "Escreva o nome do afazer.");
      return;
    }
    if (hasDueAt && !/^\d{2}:\d{2}$/.test(dueTime.trim())) {
      Alert.alert("Atenção", "Use horário no formato HH:MM, por exemplo 08:30.");
      return;
    }
    const payloadRecurrence = recurrencePayload(recurrence, timesPerDay, customInterval, customUnit);
    try {
      await api.post(`/houses/${house.id}/chores`, {
        title: title.trim(),
        description: description.trim() || null,
        due_at: selectedDueAt,
        recurrence: payloadRecurrence,
        assignee_user_ids,
      });
      await scheduleLocalReminder("Afazer da casa", title.trim(), selectedDueAt).catch(() => undefined);
      setTitle("");
      setDescription("");
      setRecurrence("none");
      setTimesPerDay("1");
      setSelected({});
      load();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function claim(chore: Chore) {
    if (!house) return;
    try {
      await api.post(`/houses/${house.id}/chores/${chore.id}/claim`);
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
        {openedFromTab ? <View style={styles.iconBtn} /> : (
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Afazeres da casa</Text>
        <View style={{ width: 42 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        {canManage && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Criar afazer</Text>
            <Text style={styles.formHint}>Escolha tarefa, dia, hora e se ela repete. Pode deixar sem responsável para alguém assumir depois.</Text>

            <Text style={styles.label}>Sugestões rápidas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
              {SUGGESTIONS.map((item) => (
                <TouchableOpacity key={item.title} style={styles.suggestionChip} onPress={() => applySuggestion(item)}>
                  <Text style={styles.suggestionText}>{item.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Nome do afazer</Text>
            <TextInput style={styles.input} placeholder="Ex.: lavar pratos" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />
            <Text style={styles.label}>Detalhes</Text>
            <TextInput style={styles.input} placeholder="Ex.: depois do jantar" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} />

            <View style={styles.switchRow}>
              <Text style={styles.labelNoMargin}>Tem dia e hora?</Text>
              <TouchableOpacity style={[styles.smallToggle, hasDueAt && styles.smallToggleActive]} onPress={() => setHasDueAt((v) => !v)}>
                <Text style={[styles.smallToggleText, hasDueAt && styles.smallToggleTextActive]}>{hasDueAt ? "Sim" : "Nao"}</Text>
              </TouchableOpacity>
            </View>

            {hasDueAt && (
              <View style={styles.calendarCard}>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity style={styles.calendarNav} onPress={() => moveCalendar(-1)}>
                    <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.calendarTitle}>
                    {MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                  </Text>
                  <TouchableOpacity style={styles.calendarNav} onPress={() => moveCalendar(1)}>
                    <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.weekRow}>
                  {WEEK_DAYS.map((d, i) => <Text key={`${d}-${i}`} style={styles.weekText}>{d}</Text>)}
                </View>
                <View style={styles.dayGrid}>
                  {calendarDays.map((item) => {
                    const active = item.date === dueDate;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        disabled={!item.day}
                        style={[styles.dayCell, active && styles.dayCellActive, !item.day && { opacity: 0 }]}
                        onPress={() => setDueDate(item.date)}
                      >
                        <Text style={[styles.dayText, active && styles.dayTextActive]}>{item.day || ""}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.selectedDate}>Data escolhida: {formatDateBR(dueDate)}</Text>
                <View style={styles.timeRow}>
                  {TIME_SLOTS.map((slot) => (
                    <TouchableOpacity key={slot} style={[styles.timeChip, dueTime === slot && styles.timeChipActive]} onPress={() => setDueTime(slot)}>
                      <Text style={[styles.timeText, dueTime === slot && styles.timeTextActive]}>{slot}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={styles.input} placeholder="HH:MM" placeholderTextColor={colors.textMuted} value={dueTime} onChangeText={setDueTime} keyboardType="numbers-and-punctuation" />
              </View>
            )}

            <Text style={styles.label}>Repetição</Text>
            <View style={styles.chips}>
              {RECURRENCE_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt.value} style={[styles.chip, recurrence === opt.value && styles.chipActive]} onPress={() => setRecurrence(opt.value)}>
                  <Text style={[styles.chipText, recurrence === opt.value && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {recurrence === "daily" && (
              <View style={styles.inlineInputRow}>
                <Text style={styles.inlineLabel}>Quantas vezes por dia?</Text>
                <TextInput style={styles.smallInput} value={timesPerDay} onChangeText={setTimesPerDay} keyboardType="number-pad" />
              </View>
            )}
            {recurrence === "custom" && (
              <View style={styles.customRow}>
                <Text style={styles.inlineLabel}>Repetir a cada</Text>
                <TextInput style={styles.smallInput} value={customInterval} onChangeText={setCustomInterval} keyboardType="number-pad" />
                {[
                  ["days", "dias"],
                  ["weeks", "semanas"],
                  ["months", "meses"],
                ].map(([value, label]) => (
                  <TouchableOpacity key={value} style={[styles.unitChip, customUnit === value && styles.unitChipActive]} onPress={() => setCustomUnit(value)}>
                    <Text style={[styles.unitText, customUnit === value && styles.unitTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Responsáveis</Text>
            <View style={styles.chips}>
              {house?.members.map((m) => (
                <TouchableOpacity key={m.user_id} style={[styles.chip, selected[m.user_id] && styles.chipActive]} onPress={() => toggleUser(m.user_id)}>
                  <Text style={[styles.chipText, selected[m.user_id] && styles.chipTextActive]}>{firstName(m.name)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.noAssigneeText}>Se ninguém for marcado, a tarefa fica livre para qualquer morador assumir.</Text>

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
            <Text style={styles.emptyText}>Crie tarefas simples para a rotina da casa. Ex.: pratos, lixo, banheiro, mercado e organização.</Text>
          </View>
        ) : (
          items.map((item) => {
            const mine = item.assignments.some((a) => a.user_id === user?.id);
            const unassigned = item.assignments.length === 0;
            const done = item.status === "done";
            const completed = item.assignments.find((a) => a.completed_at);
            return (
              <View key={item.id} style={[styles.choreCard, done && { opacity: 0.72 }]}>
                <View style={[styles.choreIcon, done && styles.choreIconDone]}>
                  <Ionicons name={done ? "checkmark" : unassigned ? "hand-left-outline" : "time-outline"} size={20} color={done ? colors.primaryText : colors.neutral} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.choreTitle}>{item.title}</Text>
                  {!!item.description && <Text style={styles.choreSub}>{item.description}</Text>}
                  <Text style={styles.choreSub}>Prazo: {formatDateTimeBR(item.due_at)} • {recurrenceLabel(item.recurrence)}</Text>
                  <Text style={styles.choreSub}>
                    {unassigned ? "Livre para alguém assumir" : `Responsável: ${item.assignments.map((a) => firstName(a.user_name)).join(", ")}`}
                  </Text>
                  {completed?.completed_at && (
                    <Text style={styles.doneText}>Feito em {formatDateTimeBR(completed.completed_at)}</Text>
                  )}
                  {!done && (
                    <View style={styles.cardActions}>
                      {unassigned && (
                        <TouchableOpacity style={styles.secondaryAction} onPress={() => claim(item)}>
                          <Text style={styles.secondaryActionText}>Assumir</Text>
                        </TouchableOpacity>
                      )}
                      {(mine || canManage || unassigned) && (
                        <TouchableOpacity style={styles.primaryAction} onPress={() => complete(item)}>
                          <Text style={styles.primaryActionText}>Marcar feito</Text>
                        </TouchableOpacity>
                      )}
                      {canManage && (
                        <TouchableOpacity style={styles.deleteAction} onPress={() => remove(item)}>
                          <Ionicons name="trash-outline" size={17} color={colors.debt} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
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
  formTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "900" },
  formHint: { color: colors.textSecondary, marginTop: 4, lineHeight: 19 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: "800", marginTop: spacing.md, marginBottom: 6 },
  labelNoMargin: { color: colors.textSecondary, fontSize: 12, fontWeight: "800" },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  suggestionRow: { gap: spacing.sm, paddingVertical: 2 },
  suggestionChip: { backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  suggestionText: { color: colors.textPrimary, fontWeight: "800", fontSize: 12 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  smallToggle: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  smallToggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  smallToggleText: { color: colors.textSecondary, fontWeight: "800" },
  smallToggleTextActive: { color: colors.primaryText },
  calendarCard: { backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginTop: spacing.sm },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  calendarNav: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.surface },
  calendarTitle: { color: colors.textPrimary, fontWeight: "900" },
  weekRow: { flexDirection: "row" },
  weekText: { width: `${100 / 7}%`, color: colors.textMuted, textAlign: "center", fontSize: 11, fontWeight: "900", paddingBottom: 5 },
  dayGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  dayCellActive: { backgroundColor: colors.primary },
  dayText: { color: colors.textPrimary, fontWeight: "800" },
  dayTextActive: { color: colors.primaryText },
  selectedDate: { color: colors.textSecondary, fontSize: 12, fontWeight: "800", marginTop: spacing.sm },
  timeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginVertical: spacing.sm },
  timeChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  timeChipActive: { backgroundColor: colors.neutral, borderColor: colors.neutral },
  timeText: { color: colors.textSecondary, fontWeight: "800", fontSize: 12 },
  timeTextActive: { color: colors.primaryText },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: "800" },
  chipTextActive: { color: colors.primaryText },
  inlineInputRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.sm },
  inlineLabel: { color: colors.textSecondary, fontWeight: "800", fontSize: 12 },
  smallInput: { minWidth: 58, textAlign: "center", backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, paddingVertical: 9, paddingHorizontal: spacing.sm },
  customRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  unitChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.bg },
  unitChipActive: { backgroundColor: colors.neutral, borderColor: colors.neutral },
  unitText: { color: colors.textSecondary, fontWeight: "800", fontSize: 12 },
  unitTextActive: { color: colors.primaryText },
  noAssigneeText: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, lineHeight: 17 },
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
  emptyText: { color: colors.textSecondary, textAlign: "center", marginTop: 4, lineHeight: 19 },
  choreCard: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  choreSub: { color: colors.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 17 },
  doneText: { color: colors.positive, fontSize: 11, fontWeight: "800", marginTop: 5 },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  secondaryAction: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryActionText: { color: colors.textPrimary, fontWeight: "900", fontSize: 12 },
  primaryAction: { backgroundColor: colors.positive, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  primaryActionText: { color: colors.primaryText, fontWeight: "900", fontSize: 12 },
  deleteAction: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: colors.debtBg },
});
