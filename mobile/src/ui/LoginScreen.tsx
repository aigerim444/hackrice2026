import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { useAuth } from '../state/AuthProvider';
import { colors, GUTTER } from '../theme/tokens';
import { T } from '../theme/type';
import { PrimaryButton } from './controls';
import { Field } from './forms';
import { Screen, Tap } from './primitives';

/**
 * Two steps, one `signInWithOtp` call: an email, then the 6-digit code that
 * email carries. The same email also carries a magic link to
 * `semesterrunway://auth-callback` — tapping it signs in without ever
 * reaching this second step, since `AuthProvider`'s deep-link handler flips
 * `signedIn` on its own. Typing the code is what still works when the link
 * doesn't fire (web, a code opened on a different device).
 */
export function LoginScreen() {
  const { sendCode, verifyCode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validEmail = /\S+@\S+\.\S+/.test(email.trim());
  const validCode = code.trim().length >= 6;

  const send = async () => {
    if (!validEmail || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendCode(email.trim());
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that — try again.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!validCode || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email.trim(), code.trim());
      // Success flips `signedIn` via onAuthStateChange — nothing to navigate,
      // the auth gate above this component swaps to the real app on its own.
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code didn't work — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingHorizontal: GUTTER, paddingTop: 80, gap: 18 }}>
          <T w={600} size={15} color={colors.muted}>
            Semester Runway
          </T>

          {step === 'email' ? (
            <>
              <T w={800} size={40} tracking={-0.03} lh={1.05}>
                What&apos;s your{'\n'}email?
              </T>
              <T w={600} size={15} color={colors.muted} lh={1.4} style={{ maxWidth: 320 }}>
                We&apos;ll send a link and a 6-digit code — whichever&apos;s easier. No password.
              </T>
              <View style={{ marginTop: 8 }}>
                <Field
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@school.edu"
                  keyboardType="default"
                  autoFocus
                />
              </View>
            </>
          ) : (
            <>
              <T w={800} size={40} tracking={-0.03} lh={1.05}>
                Check your{'\n'}email
              </T>
              <T w={600} size={15} color={colors.muted} lh={1.4} style={{ maxWidth: 320 }}>
                Tap the link in the email we sent {email.trim()}, or type the 6-digit code here.
              </T>
              <View style={{ marginTop: 8 }}>
                <Field
                  label="Code"
                  value={code}
                  onChange={setCode}
                  placeholder="123456"
                  keyboardType="number-pad"
                  autoFocus
                />
              </View>
              <Tap
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setError(null);
                }}>
                <T w={800} size={13} color={colors.green}>
                  Use a different email
                </T>
              </Tap>
            </>
          )}

          {error ? (
            <T w={600} size={13} lh={1.35} color={colors.red}>
              {error}
            </T>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: GUTTER, paddingBottom: 44 }}>
          <PrimaryButton
            label={
              step === 'email'
                ? busy
                  ? 'Sending…'
                  : 'Send code'
                : busy
                  ? 'Checking…'
                  : 'Verify'
            }
            trailing="→"
            onPress={step === 'email' ? send : verify}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
