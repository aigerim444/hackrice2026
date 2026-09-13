import { Pressable, View } from 'react-native';

import { colors, GUTTER } from '../theme/tokens';
import { T } from '../theme/type';
import { FadeIn } from './primitives';

/**
 * The confirmation line. Ink block, cream type, sits above the tab bar and
 * clears itself — every ripple in this app (a receipt logged, $20 moved, the
 * envelopes set) says what it did to your daily number.
 */
export function Toast({
  message,
  onDismiss,
  bottom = 110,
}: {
  message: string;
  onDismiss?: () => void;
  bottom?: number;
}) {
  return (
    <FadeIn
      replayKey={message}
      duration={250}
      style={{ position: 'absolute', left: GUTTER, right: GUTTER, bottom, zIndex: 5 }}>
      <Pressable onPress={onDismiss}>
        <View style={{ backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 12 }}>
          <T w={600} size={14} lh={1.35} color={colors.cream}>
            {message}
          </T>
        </View>
      </Pressable>
    </FadeIn>
  );
}
