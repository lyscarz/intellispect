import { useRef, useState } from 'react';
import {
  Page,
  Navbar,
  NavTitle,
  Block,
  BlockTitle,
  List,
  ListItem,
  ListInput,
  Button,
  Icon,
  Segmented,
  f7,
} from 'framework7-react';
import { useAuth } from '../lib/useAuth';
import {
  getStoredTheme,
  storeTheme,
  resolveDark,
  type ThemeChoice,
} from '../lib/theme';
import { SAMPLE_CERTIFICATES, SAMPLE_EXPERIENCE } from '../lib/sampleData';
import { assetInitials } from '../lib/format';
import type { Certificate } from '../types';

const NAME_KEY = 'operator-name';
const AVATAR_KEY = 'operator-avatar';

export default function Profile() {
  const { email, signOut } = useAuth();
  const defaultName = email ? email.split('@')[0] : 'Operator';

  const [name, setName] = useState<string>(localStorage.getItem(NAME_KEY) ?? defaultName);
  const [avatar, setAvatar] = useState<string | null>(localStorage.getItem(AVATAR_KEY));
  const [theme, setTheme] = useState<ThemeChoice>(getStoredTheme());
  const [certs, setCerts] = useState<Certificate[]>(SAMPLE_CERTIFICATES);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const saveName = (v: string) => {
    setName(v);
    localStorage.setItem(NAME_KEY, v);
  };

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setAvatar(url);
      localStorage.setItem(AVATAR_KEY, url);
    };
    reader.readAsDataURL(file);
  };

  const applyTheme = (choice: ThemeChoice) => {
    setTheme(choice);
    storeTheme(choice);
    // Toggle the `dark` class directly rather than f7.setDarkMode(), which
    // triggers an F7 re-render that snaps the active tab back to Home.
    document.documentElement.classList.toggle('dark', resolveDark(choice));
  };

  const addCert = () => {
    f7.dialog.prompt('Certificate or license name', 'Add', (value) => {
      const v = value.trim();
      if (!v) return;
      setCerts((c) => [
        { id: `local-${c.length + 1}`, name: v, issuer: 'Added by you', expires: null, kind: 'certificate' },
        ...c,
      ]);
    });
  };

  const confirmSignOut = () => {
    f7.dialog.confirm('Sign out of Operator?', 'Sign out', () => signOut());
  };

  const maxHours = Math.max(...SAMPLE_EXPERIENCE.map((e) => e.hours), 1);

  return (
    <Page name="profile">
      <Navbar large>
        <NavTitle large>Profile</NavTitle>
      </Navbar>

      {/* Header */}
      <div className="op-profile-head">
        <button className="op-avatar" type="button" onClick={() => fileRef.current?.click()}>
          {avatar ? (
            <img src={avatar} alt="" />
          ) : (
            <span>{assetInitials(name)}</span>
          )}
          <span className="op-avatar-edit">
            <Icon f7="camera_fill" size={14} />
          </span>
        </button>
        <div className="op-profile-name">{name}</div>
        <div className="op-sub">{email ?? '—'}</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onPickAvatar}
        />
      </div>

      {/* Edit */}
      <BlockTitle>Edit profile</BlockTitle>
      <List strongIos outlineIos insetIos>
        <ListInput
          label="Display name"
          type="text"
          value={name}
          onInput={(e) => saveName((e.target as HTMLInputElement).value)}
          clearButton
        />
        <ListItem title="Email" after={email ?? '—'} />
      </List>

      {/* Appearance */}
      <BlockTitle>Appearance</BlockTitle>
      <Block strong inset>
        <Segmented strong>
          <Button active={theme === 'light'} onClick={() => applyTheme('light')}>
            Day
          </Button>
          <Button active={theme === 'dark'} onClick={() => applyTheme('dark')}>
            Night
          </Button>
          <Button active={theme === 'system'} onClick={() => applyTheme('system')}>
            System
          </Button>
        </Segmented>
      </Block>

      {/* Certificates */}
      <BlockTitle>
        Certificates & licenses
        <Button small round className="op-inline-add" onClick={addCert}>
          <Icon f7="plus" size={15} /> Add
        </Button>
      </BlockTitle>
      <List strongIos outlineIos insetIos dividersIos>
        {certs.map((c) => (
          <ListItem
            key={c.id}
            title={c.name}
            footer={c.issuer}
            after={c.expires ? `Exp ${new Date(c.expires).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : 'No expiry'}
          >
            <Icon
              slot="media"
              f7={c.kind === 'license' ? 'creditcard_fill' : 'checkmark_seal_fill'}
              style={{ color: c.kind === 'license' ? '#2563eb' : '#059669' }}
            />
          </ListItem>
        ))}
      </List>

      {/* Experience */}
      <BlockTitle>Experience by machine type</BlockTitle>
      <Block strong inset className="op-exp">
        {SAMPLE_EXPERIENCE.map((e) => (
          <div className="op-exp-row" key={e.type}>
            <div className="op-exp-label">{e.type}</div>
            <div className="op-exp-track">
              <div className="op-exp-fill" style={{ width: `${(e.hours / maxHours) * 100}%` }} />
            </div>
            <div className="op-exp-hours">{e.hours.toLocaleString('en-US')} h</div>
          </div>
        ))}
      </Block>

      <Block>
        <Button large outline color="red" onClick={confirmSignOut}>
          Sign out
        </Button>
      </Block>
    </Page>
  );
}
