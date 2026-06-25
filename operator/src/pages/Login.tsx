import { useState } from 'react';
import {
  LoginScreen,
  Page,
  List,
  ListInput,
  ListButton,
  Block,
  BlockFooter,
  Preloader,
} from 'framework7-react';
import { supabase } from '../lib/supabase';

export default function Login({ opened }: { opened: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSignIn = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
    // On success the auth listener flips the session and the screen closes.
  };

  return (
    <LoginScreen opened={opened}>
      <Page loginScreen>
        <div className="op-login-brand">
          <div className="op-login-logo">OP</div>
          <div className="op-login-title">Operator</div>
          <div className="op-login-sub">Sign in with your fleet account</div>
        </div>

        <List form strongIos outlineIos insetIos>
          <ListInput
            label="Email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            // @ts-expect-error F7 passes this through to the input element
            autocomplete="email"
            clearButton
          />
          <ListInput
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            // @ts-expect-error F7 passes this through to the input element
            autocomplete="current-password"
          />
        </List>

        {error && (
          <Block>
            <div className="op-login-error">{error}</div>
          </Block>
        )}

        <List strongIos outlineIos insetIos>
          <ListButton
            title={busy ? 'Signing in…' : 'Log in'}
            onClick={onSignIn}
            className={busy ? 'disabled' : ''}
          />
        </List>

        {busy && (
          <Block style={{ textAlign: 'center' }}>
            <Preloader />
          </Block>
        )}

        <BlockFooter>Same login as the desktop fleet app.</BlockFooter>
      </Page>
    </LoginScreen>
  );
}
