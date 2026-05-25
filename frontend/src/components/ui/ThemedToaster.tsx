import { Toaster } from 'react-hot-toast';
import { useTheme } from '../../theme/ThemeProvider';

export function ThemedToaster(): JSX.Element {
  const { theme } = useTheme();

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        },
        success: {
          iconTheme: {
            primary: 'var(--brand)',
            secondary: 'var(--bg-surface)',
          },
        },
        error: {
          iconTheme: {
            primary: 'var(--danger)',
            secondary: 'var(--bg-surface)',
          },
        },
      }}
      key={theme}
    />
  );
}
