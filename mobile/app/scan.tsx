import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cents } from '../src/domain/format';
import { challengeRivals } from '../src/domain/selectors';
import type { Category, ParsedReceipt } from '../src/domain/types';
import { useLoadedRunway } from '../src/state/RunwayProvider';
import { colors, GUTTER, RULE } from '../src/theme/tokens';
import { T } from '../src/theme/type';
import { PrimaryButton } from '../src/ui/controls';
import { FadeIn, Flexible, Row } from '../src/ui/primitives';

/** The envelopes a receipt can be dropped into. Rent is offered, and refused. */
const ENVELOPE_CHOICES: { category: Category; label: string }[] = [
  { category: 'Drinks', label: 'Free · Drinks' },
  { category: 'Eating out', label: 'Free · Eating out' },
  { category: 'Groceries', label: 'Free · Groceries' },
];

/**
 * Receipt scan.
 *
 * Reads the price and guesses the envelope, then asks you to confirm rather than
 * filing it silently — the confirmation is where the app gets to tell you what
 * the charge does to today, and whether it breaks a streak you're in.
 */
export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const { snapshot, projection, scanReceipt, logExpense, flash } = useLoadedRunway();

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [category, setCategory] = useState<Category>('Drinks');
  const [logging, setLogging] = useState(false);
  const camera = useRef<CameraView>(null);
  const started = useRef(false);

  const live = permission?.granted === true;

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const read = useCallback(async () => {
    let imageUri: string | undefined;
    if (live && cameraReady) {
      try {
        const photo = await camera.current?.takePictureAsync({ quality: 0.6, skipProcessing: true });
        imageUri = photo?.uri;
      } catch {
        // A failed capture still leaves the demo path open; the server-side
        // parse is what matters and the mock doesn't need the bytes.
      }
    }
    const parsed = await scanReceipt({ imageUri });
    setReceipt(parsed);
    setCategory(parsed.suggestedCategory);
  }, [live, cameraReady, scanReceipt]);

  // Read once: as soon as the camera is up, or straight away if there isn't one
  // (simulator, or permission declined).
  useEffect(() => {
    if (started.current) return;
    if (permission && (!live || cameraReady)) {
      started.current = true;
      void read();
    }
  }, [permission, live, cameraReady, read]);

  const boba = snapshot.challenges.find((c) => c.category === 'Drinks');
  const breaksStreak = Boolean(receipt && category === 'Drinks' && boba && !boba.broken);
  const afterToday = receipt
    ? Math.max(0, projection.safeDaily - projection.todaySpent - receipt.amount)
    : 0;

  const sheetHeight = receipt ? 400 : 220;

  const drop = async () => {
    if (!receipt || logging) return;
    setLogging(true);
    try {
      await logExpense({
        merchant: receipt.merchant,
        amount: receipt.amount,
        category,
        envelope: 'free',
      });
      router.replace('/');
      const [rival] = boba ? challengeRivals(boba) : [];
      flash(
        `${cents(receipt.amount)} dropped into Free · ${category}.` +
          (breaksStreak
            ? rival
              ? ` Streak reset — ${rival.name}'s still at ${rival.streakDays}.`
              : ' Streak reset.'
            : ' Date unchanged.'),
      );
    } finally {
      setLogging(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <StatusBar style="light" />

      {/* The viewfinder. A real feed when there's a camera; the woven placeholder
          the design drew when there isn't. */}
      {live ? (
        <CameraView
          ref={camera}
          style={{ position: 'absolute', inset: 0 }}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
        />
      ) : (
        <>
          <Weave />
          <View
            style={{
              position: 'absolute',
              left: 60,
              right: 60,
              top: 130,
              bottom: sheetHeight,
              transform: [{ rotate: '-2deg' }],
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f6f6f6',
            }}>
            <ReceiptLines />
            <T w={600} size={12} color="#777">
              [ receipt · camera feed ]
            </T>
          </View>
        </>
      )}

      {/* Capture frame. */}
      <View
        style={{
          position: 'absolute',
          left: 40,
          right: 40,
          top: 112,
          bottom: sheetHeight - 20,
          borderWidth: RULE,
          borderColor: colors.cream,
        }}
      />

      <Row
        style={{
          position: 'absolute',
          top: insets.top + 11,
          left: GUTTER,
          right: GUTTER,
        }}>
        <Pressable onPress={() => router.replace('/')} hitSlop={12}>
          <T w={800} size={14} color={colors.cream} opacity={0.8}>
            Cancel
          </T>
        </Pressable>
        <View style={{ borderWidth: RULE, borderColor: colors.cream, paddingHorizontal: 10, paddingVertical: 3 }}>
          <T w={800} size={12} color={colors.cream}>
            {receipt ? 'Read ✓' : 'Reading…'}
          </T>
        </View>
      </Row>

      {receipt ? (
        <FadeIn
          duration={250}
          offset={10}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <View
            style={{
              backgroundColor: colors.cream,
              borderTopWidth: RULE,
              borderColor: colors.ink,
              paddingHorizontal: GUTTER,
              paddingTop: 16,
              paddingBottom: Math.max(insets.bottom, 20) + 24,
            }}>
            <Row align="flex-start" gap={10}>
              <Flexible>
                <T w={700} size={12} color={colors.muted}>
                  Looks like
                </T>
                <T w={800} size={22} lh={1.1}>
                  {receipt.merchant}
                </T>
              </Flexible>
              <T w={800} size={34} tracking={-0.03} lh={1} nowrap>
                {cents(receipt.amount)}
              </T>
            </Row>

            <T w={700} size={12} color={colors.muted} style={{ marginTop: 14 }}>
              Envelope
            </T>
            <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ENVELOPE_CHOICES.map((choice) => {
                const selected = choice.category === category;
                return (
                  <Pressable
                    key={choice.category}
                    onPress={() => setCategory(choice.category)}
                    style={({ pressed }) => ({
                      flexGrow: 1,
                      flexBasis: '46%',
                      borderWidth: RULE,
                      borderColor: colors.ink,
                      backgroundColor: selected ? colors.ink : colors.white,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      opacity: pressed && !selected ? 0.7 : 1,
                    })}>
                    <T w={800} size={14} color={selected ? colors.cream : colors.ink}>
                      {choice.label}
                    </T>
                  </Pressable>
                );
              })}
              <View
                style={{
                  flexGrow: 1,
                  flexBasis: '46%',
                  borderWidth: RULE,
                  borderStyle: 'dashed',
                  borderColor: colors.tan,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}>
                <T w={800} size={14} color={colors.muted}>
                  Rent (don&apos;t)
                </T>
              </View>
            </View>

            <Row
              style={{
                marginTop: 12,
                borderBottomWidth: RULE,
                borderColor: colors.ruleSoft,
                paddingVertical: 12,
              }}>
              <T w={600} size={14}>
                Today after this
              </T>
              <T w={600} size={14} nowrap>
                <T w={800} size={14}>
                  {cents(afterToday)}
                </T>{' '}
                left · date unchanged
              </T>
            </Row>

            {breaksStreak ? (
              <View
                style={{
                  marginTop: 10,
                  backgroundColor: colors.blush,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}>
                <T w={600} size={13} lh={1.35}>
                  3rd boba this week — breaks your{' '}
                  <T w={800} size={13}>
                    {boba?.label}
                  </T>{' '}
                  streak (day {boba?.youStreakDays}).
                </T>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <PrimaryButton
                label={logging ? 'Dropping…' : 'Drop it in'}
                height={52}
                onPress={drop}
                style={{ flex: 1 }}
              />
              <Pressable
                onPress={() => router.replace('/')}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 52,
                  backgroundColor: colors.white,
                  borderWidth: RULE,
                  borderColor: colors.ink,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}>
                <T w={800} size={15}>
                  Cancel
                </T>
              </Pressable>
            </View>
          </View>
        </FadeIn>
      ) : null}
    </View>
  );
}

/** The dark diagonal weave behind the placeholder viewfinder. */
function Weave() {
  return (
    <View style={{ position: 'absolute', inset: 0, backgroundColor: colors.scanWeaveB, overflow: 'hidden' }}>
      {Array.from({ length: 60 }).map((_, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            top: -400,
            bottom: -400,
            left: index * 20 - 200,
            width: 10,
            backgroundColor: colors.scanWeaveA,
            transform: [{ rotate: '45deg' }],
          }}
        />
      ))}
    </View>
  );
}

/** Ruled paper, so the placeholder reads as a receipt rather than a blank card. */
function ReceiptLines() {
  return (
    <View style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {Array.from({ length: 40 }).map((_, index) => (
        <View
          key={index}
          style={{ height: 14, borderBottomWidth: 2, borderColor: '#ececec' }}
        />
      ))}
    </View>
  );
}
