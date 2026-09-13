import { Pressable, View } from 'react-native';

import { colors, GUTTER, RULE } from '../theme/tokens';
import { T } from '../theme/type';
import { CameraIcon } from './icons';
import { FadeIn, Flexible } from './primitives';

export interface AddMenuAction {
  id: string;
  title: string;
  sublabel: string;
  /** A camera glyph, or a single character like `?` / `→`. */
  icon: 'camera' | string;
  onPress: () => void;
}

const BUTTON = 56;

/**
 * The + button, and the popover it opens.
 *
 * This replaced a bottom sheet late in the design: anchored above the button
 * with a little pointer, so the three actions read as belonging to the + rather
 * than arriving from off-screen. The button itself stays a square — only the
 * glyph rotates into an ×.
 */
export function AddButton({
  open,
  onToggle,
  bottom,
}: {
  open: boolean;
  onToggle: () => void;
  bottom: number;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={open ? 'Close actions' : 'Add'}
      style={({ pressed }) => ({
        position: 'absolute',
        right: GUTTER,
        bottom,
        zIndex: 8,
        width: BUTTON,
        height: BUTTON,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: open ? colors.cream : colors.ink,
        ...(open ? { borderWidth: RULE, borderColor: colors.ink } : null),
        opacity: pressed ? 0.85 : 1,
      })}>
      <T
        w={800}
        size={30}
        lh={1}
        color={open ? colors.ink : colors.cream}
        style={open ? { transform: [{ rotate: '45deg' }] } : undefined}>
        +
      </T>
    </Pressable>
  );
}

export function AddMenu({
  actions,
  onDismiss,
  bottom,
}: {
  actions: AddMenuAction[];
  onDismiss: () => void;
  bottom: number;
}) {
  return (
    <>
      <Pressable
        accessibilityLabel="Dismiss"
        onPress={onDismiss}
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(30,26,23,0.35)', zIndex: 6 }}
      />
      <FadeIn
        duration={180}
        style={{ position: 'absolute', right: GUTTER, bottom, width: 280, zIndex: 7 }}>
        <View style={{ backgroundColor: colors.cream, borderWidth: RULE, borderColor: colors.ink }}>
          {actions.map((action, index) => (
            <Pressable
              key={action.id}
              onPress={action.onPress}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                opacity: pressed ? 0.65 : 1,
                ...(index < actions.length - 1
                  ? { borderBottomWidth: RULE, borderColor: colors.ink }
                  : null),
              })}>
              {action.icon === 'camera' ? (
                <CameraIcon />
              ) : (
                <T w={800} size={18} center style={{ width: 20 }}>
                  {action.icon}
                </T>
              )}
              <Flexible>
                <T w={800} size={16} lh={1.1}>
                  {action.title}
                </T>
                <T w={600} size={12} color={colors.muted} nowrap>
                  {action.sublabel}
                </T>
              </Flexible>
            </Pressable>
          ))}
          {/* The pointer back down to the + button. */}
          <View
            style={{
              position: 'absolute',
              right: 16,
              bottom: -12,
              width: 20,
              height: 20,
              backgroundColor: colors.cream,
              borderRightWidth: RULE,
              borderBottomWidth: RULE,
              borderColor: colors.ink,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </View>
      </FadeIn>
    </>
  );
}
