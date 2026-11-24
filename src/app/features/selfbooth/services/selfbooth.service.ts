import { Injectable } from '@angular/core';
import {
  SelfBoothPackage,
  SelfBoothTicket,
  QueueStatus,
  PaymentInfo,
  WebFrame,
  WebColorFilter,
  WebPrintOrder
} from '../models/selfbooth.models';

@Injectable({
  providedIn: 'root'
})
export class SelfBoothService {
  private readonly baseUrl = '';

  async getCatalog(): Promise<{ packages: SelfBoothPackage[]; stores: any[] }> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-catalog`);
    if (!res.ok) {
      throw new Error('Không thể tải danh mục gói chụp');
    }
    return await res.json();
  }

  async createTicket(payload: {
    packageId: string;
    storeId?: string;
    machineId?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    paymentMethod?: string;
  }): Promise<{ ok: boolean; ticket: SelfBoothTicket; payment: PaymentInfo }> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || data.error || 'Đặt vé không thành công');
    }
    return data;
  }

  async getTicket(code: string): Promise<{
    ok: boolean;
    ticket: SelfBoothTicket;
    queue: QueueStatus;
    printQuota: { total: number; used: number; remaining: number };
    payment?: PaymentInfo;
  }> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-tickets?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || data.error || 'Không tìm thấy thông tin vé');
    }
    return data;
  }

  async getFramesAndFilters(): Promise<{
    ok: boolean;
    frames: WebFrame[];
    filters: WebColorFilter[];
  }> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-frames`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error('Không thể tải kho khung và bộ lọc');
    }
    return data;
  }

  async submitPrintOrder(payload: {
    ticketCode: string;
    copies: number;
    fileBase64: string;
    storeId?: string;
    machineId?: string;
    source?: string;
  }): Promise<{
    ok: boolean;
    orderId: string;
    copies: number;
    printsUsed: number;
    printsRemaining: number;
    status: string;
  }> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-print-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || data.error || 'Không thể gửi lệnh in');
    }
    return data;
  }

  async fetchSessionPhotos(sessionPublicId: string): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/gallery?s=${encodeURIComponent(sessionPublicId)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    } catch {
      return [];
    }
  }
}
