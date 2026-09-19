export interface IAuditLog {
  id: string;
  userId?: string | null;
  action: string;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
}
