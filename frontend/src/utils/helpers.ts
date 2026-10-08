export const fmtDate = (iso?: string) => {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

export const fmtTime = (iso?: string) => {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export const fmtDateTime = (iso?: string) => {
  if (!iso) return 'TBA';
  return `${fmtDate(iso)} at ${fmtTime(iso)}`;
};

export const errText = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

export const statusColor = (status?: string) => {
  switch (status) {
    case 'Completed': return 'success';
    case 'Scheduled': return 'info';
    case 'Pending': return 'warning';
    case 'Walkover': return 'warning';
    case 'DoubleForfeit': return 'error';
    case 'Abandoned': return 'error';
    default: return 'primary';
  }
};
