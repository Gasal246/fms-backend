import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { CateringUseCase } from './catering.usecase.js';
import { AuthUseCase } from './auth.usecase.js';
import KitchenManager from '../../infrastructure/persistence/models/kitchen-manager.model.js';

const managerScope = { clientId: '64b000000000000000000001', userId: '64b000000000000000000002', role: 'ROLE_KITCHEN_MANAGER', kitchenIds: ['kitchen-1'] };

function repository(seed: Record<string, any[]>) {
  const rows = structuredClone(seed);
  return {
    rows,
    async list(entity: string, _scope: any, query: Record<string, any> = {}) {
      return (rows[entity] || []).filter((row) => Object.entries(query).every(([key, value]) => String(row[key === '_id' ? 'id' : key]) === String(value)));
    },
    async create(entity: string, _scope: any, data: any) {
      const row = { id: `${entity}-${(rows[entity] || []).length + 1}`, ...data, version: 0 };
      (rows[entity] ||= []).push(row);
      return row;
    },
    async update(entity: string, _scope: any, id: string, data: any) {
      const index = (rows[entity] || []).findIndex((row) => row.id === id);
      const row = { ...data, id, version: Number(rows[entity][index]?.version || 0) + 1 };
      rows[entity][index] = row;
      return row;
    },
    async remove() {},
  };
}

const passwordService = { hash: vi.fn(async (value: string) => `hash:${value}`), compare: vi.fn(async () => true) };

describe('Kitchen Manager catering authorization and workflows', () => {
  it('allows only the three manager order transitions', async () => {
    const repo = repository({ kitchenOrders: [{ id: 'order-1', kitchenId: 'kitchen-1', status: 'Sent', version: 0 }] });
    const service = new CateringUseCase(repo as any, passwordService as any);
    const result = await service.kitchenOrderAction(managerScope, 'order-1', { action: 'accept', expectedStatus: 'Sent', version: 0 });
    expect(result.status).toBe('Accepted');
    await expect(service.kitchenOrderAction(managerScope, 'order-1', { action: 'mark_received' })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects access to an unassigned kitchen order', async () => {
    const repo = repository({ kitchenOrders: [{ id: 'order-2', kitchenId: 'kitchen-2', status: 'Sent', version: 0 }] });
    const service = new CateringUseCase(repo as any, passwordService as any);
    await expect(service.kitchenOrderAction(managerScope, 'order-2', { action: 'accept' })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('supports partial dispatches but never exceeds an order line', async () => {
    const repo = repository({
      kitchenOrders: [{ id: 'order-1', kitchenId: 'kitchen-1', status: 'Ready', scheduleId: 's1', categoryId: 'c1', lines: [{ id: 'line-1', quantity: 10, destinationType: 'Camp', destinationId: 'camp-1' }] }],
      dispatches: [{ id: 'dispatch-1', orderId: 'order-1', lineId: 'line-1', dispatchedQuantity: 6, managerId: managerScope.userId }],
    });
    const service = new CateringUseCase(repo as any, passwordService as any);
    await expect(service.createKitchenDispatch(managerScope, { orderId: 'order-1', lineId: 'line-1', dispatchedQuantity: 5 })).rejects.toMatchObject({ statusCode: 409 });
    const created = await service.createKitchenDispatch(managerScope, { orderId: 'order-1', lineId: 'line-1', dispatchedQuantity: 4 });
    expect(created).toMatchObject({ managerId: managerScope.userId, dispatchedQuantity: 4, status: 'Generated' });
  });

  it('prevents one manager from editing another manager dispatch', async () => {
    const repo = repository({
      kitchenOrders: [{ id: 'order-1', kitchenId: 'kitchen-1', status: 'Ready', lines: [{ id: 'line-1', quantity: 10 }] }],
      dispatches: [{ id: 'dispatch-1', orderId: 'order-1', lineId: 'line-1', kitchenId: 'kitchen-1', managerId: 'another-manager', status: 'Generated', dispatchedQuantity: 2 }],
    });
    const service = new CateringUseCase(repo as any, passwordService as any);
    await expect(service.updateKitchenDispatch(managerScope, 'dispatch-1', { dispatchedQuantity: 2 })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.kitchenDispatchAction(managerScope, 'dispatch-1', { action: 'mark_ready' })).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('Kitchen Manager account security', () => {
  it('never serializes the password hash', () => {
    const id = () => new mongoose.Types.ObjectId();
    const manager = new KitchenManager({ client_id: id(), role_id: id(), kitchen_ids: [id()], created_by: id(), name: 'Chef Manager', email: 'CHEF@EXAMPLE.COM', phone: '+971500000000', password: 'secret-hash' });
    const output = manager.toJSON() as any;
    expect(output.password).toBeUndefined();
    expect(output.email).toBe('chef@example.com');
    expect(output.kitchenIds).toHaveLength(1);
  });

  it('issues manager context only for an active account with assignments', async () => {
    const authRepository = {
      findByEmailAndRoleSlug: vi.fn(async () => ({ _id: { toString: () => 'manager-1' }, client_id: { toString: () => 'client-1' }, role_id: 'role-1', email: 'chef@example.com', password: 'hash', name: 'Chef', phone: '050', status: 'Active', kitchen_ids: [{ toString: () => 'kitchen-1' }] })),
      getRolesBySlugs: vi.fn(async () => [{ _id: { toString: () => 'role-1' } }]),
    };
    const tokenService = { sign: vi.fn(async (payload: any) => `token:${payload.id}`) };
    const permissions = { getPermissionsByRole: vi.fn(async () => [{ permission_slug: 'manage_kitchen_orders' }]) };
    const service = new AuthUseCase(authRepository as any, passwordService as any, tokenService as any, {} as any, permissions as any, {} as any, {} as any);
    const result = await service.signIn({ email: 'chef@example.com', password: 'password', role_slug: 'ROLE_KITCHEN_MANAGER' });
    expect(result.user).toMatchObject({ role: 'ROLE_KITCHEN_MANAGER', kitchenIds: ['kitchen-1'] });
    expect(tokenService.sign).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'client-1', kitchen_ids: ['kitchen-1'] }));
  });

  it('rejects blocked Kitchen Manager login immediately', async () => {
    const authRepository = { findByEmailAndRoleSlug: vi.fn(async () => ({ password: 'hash', status: 'Blocked', kitchen_ids: ['kitchen-1'] })) };
    const service = new AuthUseCase(authRepository as any, passwordService as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    await expect(service.signIn({ email: 'chef@example.com', password: 'password', role_slug: 'ROLE_KITCHEN_MANAGER' })).rejects.toMatchObject({ statusCode: 403 });
  });
});
