import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../src/ThemeContext";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 58 + bottomInset,
          paddingTop: 6,
          paddingBottom: bottomInset,
        },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Início",
        tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="expenses" options={{ title: "Gastos",
        tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="recurring" options={{ title: "Recorrentes",
        tabBarIcon: ({ color, size }) => <Ionicons name="repeat" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="debts" options={{ title: "Acertos",
        tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil",
        tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="members" options={{ href: null }} />
    </Tabs>
  );
}
