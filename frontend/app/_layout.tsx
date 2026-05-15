import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/AuthContext";
import { AppModeProvider } from "../src/AppModeContext";
import { SyncStatusBanner } from "../src/SyncStatusBanner";
import { ThemeProvider, useAppTheme } from "../src/ThemeContext";
import { prepareNotifications } from "../src/notifications";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppModeProvider>
          <AuthProvider>
            <RootStack />
          </AuthProvider>
        </AppModeProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { colors, mode } = useAppTheme();

  useEffect(() => {
    prepareNotifications().catch(() => undefined);
  }, []);

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} backgroundColor={colors.bg} />
      <SyncStatusBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="tutorial" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="expense/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="contribution/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="help" />
        <Stack.Screen name="shopping-list" />
        <Stack.Screen name="statement" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="bills" />
        <Stack.Screen name="chores" />
        <Stack.Screen name="terms-lgpd" />
      </Stack>
    </>
  );
}
