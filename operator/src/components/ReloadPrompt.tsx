import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { f7 } from 'framework7-react';

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      window.setInterval(check, UPDATE_CHECK_INTERVAL);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    f7.dialog.confirm(
      'A new version of Operator is available. Update now?',
      'Update',
      () => updateServiceWorker(true),
      () => setNeedRefresh(false)
    );
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
