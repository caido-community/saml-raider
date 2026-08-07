type Badge = { setCount: (count: number) => void };

let badge: Badge | undefined = undefined;

let pending = 0;

const listeners = new Set<() => void>();

const show = () => badge?.setCount(pending);

export const trackImportedCertificates = (item: Badge) => {
  badge = item;
  show();
};

export const rememberImportedCertificates = (count: number) => {
  if (count <= 0) return;

  pending += count;
  show();
  for (const listener of listeners) listener();
};

export const onCertificatesImported = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const forgetImportedCertificates = () => {
  if (pending === 0) return;

  pending = 0;
  show();
};
