// Hand-off for a file picked on the Home dropzone: Home stashes it, Scan takes
// it on mount and runs the normal flow.
// ponytail: module-level, not store state — it lives for exactly one navigation
// and nothing renders from it. Move it into the store if a second consumer shows up.
let pending: File | null = null;

export function setPendingFile(f: File | null) {
  pending = f;
}

export function takePendingFile(): File | null {
  const f = pending;
  pending = null;
  return f;
}
