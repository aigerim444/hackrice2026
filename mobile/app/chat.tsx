import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QUICK_ASKS } from '../src/domain/coach';
import { cents } from '../src/domain/format';
import type { ChatMessage } from '../src/domain/types';
import { useLoadedRunway } from '../src/state/RunwayProvider';
import { colors, fonts, GUTTER, RULE } from '../src/theme/tokens';
import { T } from '../src/theme/type';
import { Chip } from '../src/ui/controls';
import { CameraIcon, SendIcon } from '../src/ui/icons';
import { FadeIn, Flexible, Row, Screen, Tap } from '../src/ui/primitives';

/**
 * The what-if coach.
 *
 * A real thread, not a form: short bubbles rather than one big answer card, so
 * the verdict lands before the alternatives do. Every answer is priced in days
 * of runway, and the cheaper routes are tappable-looking rows because that's the
 * part you act on.
 */
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { snapshot, projection, askCoach, coachThinking } = useLoadedRunway();
  const [draft, setDraft] = useState('');
  const scroller = useRef<ScrollView>(null);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setDraft('');
    void askCoach(trimmed);
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}>
        <Row
          style={{
            paddingHorizontal: GUTTER,
            paddingTop: 8,
            paddingBottom: 10,
            borderBottomWidth: RULE,
            borderColor: colors.ink,
          }}>
          <Row gap={10} style={{ flex: 1, justifyContent: 'flex-start' }}>
            <Tap onPress={() => router.back()} hitSlop={12}>
              <T w={800} size={16}>
                ←
              </T>
            </Tap>
            <Avatar size={32} />
            <Flexible>
              <T w={800} size={16} lh={1.1}>
                Runway
              </T>
              <T w={700} size={11} color={colors.muted} nowrap>
                sees envelopes + shifts
              </T>
            </Flexible>
          </Row>
          <T w={700} size={12} color={colors.muted} nowrap>
            {cents(projection.leftToday)} left today
          </T>
        </Row>

        <ScrollView
          ref={scroller}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8, gap: 10 }}
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}>
          {snapshot.chat.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
          {coachThinking ? (
            <FadeIn style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 8 }}>
              <Avatar size={24} />
              <View style={{ backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 10 }}>
                <T w={600} size={15} color={colors.muted}>
                  …
                </T>
              </View>
            </FadeIn>
          ) : null}
        </ScrollView>

        {/* The chip rail sizes to its content: without `flexGrow: 0` a horizontal
            ScrollView takes the column's leftover space, and `alignItems` keeps
            the chips pill-height instead of stretching to fill it. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: 10,
            gap: 8,
            alignItems: 'center',
          }}>
          {QUICK_ASKS.map((ask) => (
            <Chip key={ask.text} label={ask.text} onPress={() => send(ask.send)} />
          ))}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 18,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          }}>
          <Pressable
            onPress={() => router.push('/scan')}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderWidth: RULE,
              borderColor: colors.ink,
              backgroundColor: colors.white,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}>
            <CameraIcon size={18} />
          </Pressable>

          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => send(draft)}
            returnKeyType="send"
            placeholder="if I buy… $"
            placeholderTextColor={colors.tan}
            style={{
              flex: 1,
              minWidth: 0,
              height: 44,
              backgroundColor: colors.white,
              borderWidth: RULE,
              borderColor: colors.ink,
              paddingHorizontal: 12,
              fontFamily: fonts.semibold,
              fontSize: 15,
              color: colors.ink,
            }}
          />

          <Pressable
            onPress={() => send(draft)}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              backgroundColor: colors.ink,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}>
            <SendIcon />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Avatar({ size }: { size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderWidth: RULE,
        borderColor: colors.ink,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <T w={800} size={size / 2.3}>
        R
      </T>
    </View>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <FadeIn
        style={{
          alignSelf: 'flex-end',
          maxWidth: '76%',
          backgroundColor: colors.ink,
          paddingHorizontal: 13,
          paddingVertical: 9,
        }}>
        <T w={600} size={15} lh={1.35} color={colors.cream}>
          {message.text}
        </T>
      </FadeIn>
    );
  }

  return (
    <FadeIn style={{ alignSelf: 'flex-start', maxWidth: '88%', flexDirection: 'row', gap: 8 }}>
      <View style={{ marginTop: 2 }}>
        <Avatar size={24} />
      </View>
      <View style={{ flex: 1, backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 10 }}>
        <T w={600} size={15} lh={1.35}>
          {message.text}
        </T>

        {message.routes?.length ? (
          <View style={{ marginTop: 8, gap: 6 }}>
            {message.routes.map((route) => (
              <Row
                key={route.label}
                gap={10}
                style={{
                  backgroundColor: route.tone === 'good' ? colors.sage : colors.white,
                  borderWidth: RULE,
                  borderColor: colors.ink,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}>
                {/* Route labels are the one place long copy is allowed to wrap. */}
                <T w={600} size={14} style={{ flex: 1 }}>
                  {route.label}
                </T>
                <T w={800} size={14} nowrap color={route.tone === 'good' ? colors.green : colors.ink}>
                  {route.delta}
                </T>
              </Row>
            ))}
          </View>
        ) : null}

        {/* The receipt. The coach isn't allowed to do arithmetic — it can only
            quote what the projection engine handed back — so showing which
            what-ifs it ran is showing where every figure above came from. */}
        {message.trace?.length ? (
          <View
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTopWidth: RULE,
              borderColor: colors.ruleSoft,
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
            }}>
            <T w={800} size={10} caps tracking={0.06} color={colors.muted}>
              ran
            </T>
            {message.trace.map((step, index) => (
              <View
                key={`${step}-${index}`}
                style={{
                  borderWidth: RULE,
                  borderColor: colors.ruleSoft,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                }}>
                <T w={700} size={11} color={colors.muted}>
                  {step}
                </T>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </FadeIn>
  );
}
