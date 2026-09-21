export const ChannelStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type ChannelStatus = (typeof ChannelStatus)[keyof typeof ChannelStatus];
