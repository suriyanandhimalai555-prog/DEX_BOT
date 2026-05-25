import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';

/** Toast-based confirm (react-hot-toast). Replaces TOTP for sensitive bot actions. */
export function confirmBotLifecycleAction(
  title: string,
  description: string,
  onConfirm: () => void
): void {
  toast.custom(
    (t) => (
      <div className="pointer-events-auto w-[min(100vw-2rem,20rem)] rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-2xl">
        <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="text-xs" onClick={() => toast.dismiss(t.id)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="text-xs"
            onClick={() => {
              toast.dismiss(t.id);
              onConfirm();
            }}
          >
            Confirm
          </Button>
        </div>
      </div>
    ),
    { duration: Infinity }
  );
}
