import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppMode } from "../../src/AppModeContext";
import { useAppTheme } from "../../src/ThemeContext";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);
  const { colors } = useAppTheme();
  const { appMode } = useAppMode();
  const isHouse = appMode === "house";

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
      <Tabs.Screen name="index" options={{ title: isHouse ? "Lar" : "Início",
        tabBarIcon: ({ color, size }) => <Ionicons name={isHouse ? "home" : "wallet"} size={size - 2} color={color} /> }} />
      <Tabs.Screen name="expenses" options={{ href: isHouse ? null : undefined, title: "Gastos",
        tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="recurring" options={{ href: isHouse ? null : undefined, title: "Recorrentes",
        tabBarIcon: ({ color, size }) => <Ionicons name="repeat" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="debts" options={{ href: isHouse ? null : undefined, title: "Acertos",
        tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="house-tasks" options={{ href: isHouse ? undefined : null, title: "Afazeres",
        tabBarIcon: ({ color, size }) => <Ionicons name="checkbox" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="shopping" options={{ href: isHouse ? undefined : null, title: "Compras",
        tabBarIcon: ({ color, size }) => <Ionicons name="cart" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="house-bills" options={{ href: isHouse ? undefined : null, title: "Contas",
        tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil",
        tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="members" options={{ href: null }} />
    </Tabs>
  );
}
