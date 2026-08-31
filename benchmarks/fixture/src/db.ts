export interface User {
  id: string;
  email: string;
  orgId: string;
  role: 'admin' | 'member';
  token: string;
}

export interface Invoice {
  id: string;
  orgId: string;
  title: string;
  amountCents: number;
  status: 'active' | 'cancelled';
  deletedAt?: string | null;
}

export interface Slot {
  id: string;
  booked: boolean;
  bookedBy?: string;
  bookedAt?: string;
}

export class Database {
  private users: Map<string, User> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private slots: Map<string, Slot> = new Map();
  private slotLock: boolean = false;

  constructor() {
    this.seed();
  }

  public seed() {
    this.users.clear();
    this.invoices.clear();
    this.slots.clear();
    this.slotLock = false;

    // Users
    this.users.set('token-admin-alpha', {
      id: 'usr-alpha-1',
      email: 'admin@alpha.com',
      orgId: 'org-alpha',
      role: 'admin',
      token: 'token-admin-alpha',
    });
    this.users.set('token-member-alpha', {
      id: 'usr-alpha-2',
      email: 'member@alpha.com',
      orgId: 'org-alpha',
      role: 'member',
      token: 'token-member-alpha',
    });
    this.users.set('token-admin-beta', {
      id: 'usr-beta-1',
      email: 'admin@beta.com',
      orgId: 'org-beta',
      role: 'admin',
      token: 'token-admin-beta',
    });

    // Invoices
    this.invoices.set('inv-alpha-001', {
      id: 'inv-alpha-001',
      orgId: 'org-alpha',
      title: 'Alpha Enterprise Subscription',
      amountCents: 50000, // $500.00
      status: 'active',
      deletedAt: null,
    });
    this.invoices.set('inv-alpha-002', {
      id: 'inv-alpha-002',
      orgId: 'org-alpha',
      title: 'Alpha Addon Credits',
      amountCents: 10000, // $100.00
      status: 'active',
      deletedAt: '2026-08-30T10:00:00Z', // Soft-deleted
    });
    this.invoices.set('inv-beta-001', {
      id: 'inv-beta-001',
      orgId: 'org-beta',
      title: 'Beta Basic Plan',
      amountCents: 25000, // $250.00
      status: 'active',
      deletedAt: null,
    });

    // Slots
    this.slots.set('SLOT-101', {
      id: 'SLOT-101',
      booked: false,
    });
  }

  public getUserByToken(token: string): User | undefined {
    return this.users.get(token);
  }

  public getInvoice(id: string): Invoice | undefined {
    return this.invoices.get(id);
  }

  public getAllInvoices(): Invoice[] {
    return Array.from(this.invoices.values());
  }

  public updateInvoice(id: string, update: Partial<Invoice>): Invoice | undefined {
    const inv = this.invoices.get(id);
    if (!inv) return undefined;
    const updated = { ...inv, ...update };
    this.invoices.set(id, updated);
    return updated;
  }

  public getSlot(id: string): Slot | undefined {
    return this.slots.get(id);
  }

  // Atomic transactional booking
  public async bookSlotAtomic(slotId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    // Acquire lock / transaction
    while (this.slotLock) {
      await new Promise(r => setTimeout(r, 1));
    }
    this.slotLock = true;
    try {
      // Simulate minor async I/O delay
      await new Promise(r => setTimeout(r, 5));
      const slot = this.slots.get(slotId);
      if (!slot) {
        return { success: false, error: 'Slot not found' };
      }
      if (slot.booked) {
        return { success: false, error: 'Slot already booked' };
      }
      slot.booked = true;
      slot.bookedBy = userId;
      slot.bookedAt = new Date().toISOString();
      this.slots.set(slotId, slot);
      return { success: true };
    } finally {
      this.slotLock = false;
    }
  }

  // Non-atomic buggy booking (used for REG-2 mutation)
  public async bookSlotNonAtomic(slotId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const slot = this.slots.get(slotId);
    if (!slot) return { success: false, error: 'Slot not found' };
    if (slot.booked) return { success: false, error: 'Slot already booked' };

    // Vulnerability: async gap between check and write without lock
    await new Promise(r => setTimeout(r, 10));
    slot.booked = true;
    slot.bookedBy = userId;
    this.slots.set(slotId, slot);
    return { success: true };
  }
}

export const db = new Database();
