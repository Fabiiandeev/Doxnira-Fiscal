export type AccountantFilters = { companyId?: string; status?: string; severity?: string; page?: number; pageSize?: number; from?: string; to?: string };
export type RiskItem = { companyId: string; companyName: string; score: number; classification: string; factors: Array<{ key: string; count: number; weight: number; penalty: number }>; recommendedActions: string[]; updatedAt: string };
export type QueueItem = { id: string; companyId: string; type: string; origin: string; title: string; description?: string; severity: string; priority: string; status: string; responsibleUserId?: string; dueAt?: string; competence?: string; createdAt: string; updatedAt: string };
export type Paginated<T> = { items: T[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
