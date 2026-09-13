import {
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/baloo-2';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '../src/theme/tokens';
import { T } from '../src/theme/type';
import { OutlineButton } from '../src/ui/controls';
import { RunwayProvider, useRunway } from '../src/state/RunwayProvider';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* Racing an already-hidden splash is not an error worth surfacing. */
});

/**
 * Holds the splash until both the type and the semester are ready.
 *
 * Baloo 2 is the whole voice of this design — the app flashing a system font
 * before it loads would be the first thing you'd notice — so nothing renders
 * until the faces are in.
 */
function Gate({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  const { loading, error, refetch } = useRunway();
  const canRender = ready && !loading;

  useEffect(() => {
    if (canRender) SplashScreen.hideAsync().catch(() => {});
  }, [canRender]);

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.cream,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}>
        <T w={800} size={22} center>
          Couldn&apos;t load your semester
        </T>
        <T w={600} size={15} color={colors.muted} center lh={1.4} style={{ marginTop: 8 }}>
          {error}
        </T>
        <View style={{ marginTop: 20, alignSelf: 'stretch', maxWidth: 220 }}>
          <OutlineButton label="Try again" onPress={() => void refetch()} height={48} />
        </View>
      </View>
    );
  }

  if (!canRender) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
  });

  return (
    <SafeAreaProvider>
      <RunwayProvider>
        <Gate ready={fontsLoaded || Boolean(fontError)}>
          {/* The status bar sits on cream on most screens and on ink for the
              camera and the dark Wrapped cards; those screens set it themselves. */}
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.cream },
              animation: 'slide_from_right',
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="spend" options={{ animation: 'fade' }} />
            <Stack.Screen name="friends" options={{ animation: 'fade' }} />
            <Stack.Screen name="you" options={{ animation: 'fade' }} />
            <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="wrapped" options={{ animation: 'slide_from_bottom' }} />
          </Stack>
        </Gate>
      </RunwayProvider>
    </SafeAreaProvider>
  );
}
