import React from 'react';

interface StatusPillProps {
  status: string;
}

const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'primary' }> = {
  Completed: { label: 'Completed', variant: 'success' },
  Scheduled: { label: 'Scheduled', variant: 'info' },
  Pending: { label: 'Pending', variant: 'warning' },
  Walkover: { label: 'Walkover', variant: 'warning' },
  DoubleForfeit: { label: 'Forfeit', variant: 'error' },
  Abandoned: { label: 'Abandoned', variant: 'error' },
  InProgress: { label: 'In Progress', variant: 'primary' },
};

export const StatusPill: React.FC<StatusPillProps> = ({ status }) => {
  const config = statusMap[status] || { label: status, variant: 'primary' };
  return <span className={`badge badge-${config.variant}`}>{config.label}</span>;
};
