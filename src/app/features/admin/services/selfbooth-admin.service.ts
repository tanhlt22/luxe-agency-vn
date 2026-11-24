import { Injectable } from '@angular/core';
import { SelfBoothTicket, WebPrintOrder, WebFrame, WebColorFilter, SelfBoothPackage } from '../../selfbooth/models/selfbooth.models';

@Injectable({
  providedIn: 'root'
})
export class SelfBoothAdminService {
  private readonly baseUrl = '';

  async login(pin: string, storeId = 'store_hp_01'): Promise<{ ok: boolean; staff: any }> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, storeId })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Đăng nhập không thành công');
    }
    return data;
  }

  async logout(): Promise<void> {
    await fetch(`${this.baseUrl}/api/selfbooth-admin?action=logout`);
  }

  async checkAuth(): Promise<{ ok: boolean; staff?: any }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=me`);
      if (!res.ok) return { ok: false };
      return await res.json();
    } catch {
      return { ok: false };
    }
  }

  async listTickets(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    storeId?: string;
  } = {}): Promise<{
    ok: boolean;
    tickets: SelfBoothTicket[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.status) q.set('status', params.status);
    if (params.storeId) q.set('storeId', params.storeId);

    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=list-tickets&${q.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Không thể tải danh sách vé');
    }
    return data;
  }

  async issueTicket(payload: {
    packageId: string;
    storeId?: string;
    machineId?: string;
    customerName?: string;
    customerPhone?: string;
    paymentMethod?: string;
    confirmNow?: boolean;
  }): Promise<{ ok: boolean; ticket: SelfBoothTicket }> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=issue-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || data.error || 'Phát vé thất bại');
    }
    return data;
  }

  async confirmPayment(ticketId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Xác nhận thanh toán thất bại');
    }
  }

  async cancelTicket(ticketId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=cancel-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Hủy vé thất bại');
    }
  }

  async listPrintOrders(params: {
    storeId?: string;
    status?: string;
    ticketCode?: string;
  } = {}): Promise<{ ok: boolean; orders: WebPrintOrder[] }> {
    const q = new URLSearchParams();
    if (params.storeId) q.set('storeId', params.storeId);
    if (params.status) q.set('status', params.status);
    if (params.ticketCode) q.set('ticketCode', params.ticketCode);

    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=list-print-orders&${q.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Không thể tải hàng đợi in');
    }
    return data;
  }

  async retryPrintOrder(orderId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=retry-print-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Thử lại lệnh in thất bại');
    }
  }

  async listFrames(): Promise<{ ok: boolean; frames: WebFrame[] }> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=list-frames`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error('Không thể tải kho khung');
    return data;
  }

  async createFrame(frame: Partial<WebFrame>): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=create-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(frame)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Tạo khung thất bại');
  }

  async updateFrame(frame: Partial<WebFrame>): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=update-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(frame)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Cập nhật khung thất bại');
  }

  async deleteFrame(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=delete-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Xóa khung thất bại');
  }

  async listFilters(): Promise<{ ok: boolean; filters: WebColorFilter[] }> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=list-filters`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error('Không thể tải bộ lọc');
    return data;
  }

  async createFilter(filter: Partial<WebColorFilter>): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=create-filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filter)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Tạo bộ lọc thất bại');
  }

  async updateFilter(filter: Partial<WebColorFilter>): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=update-filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filter)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Cập nhật bộ lọc thất bại');
  }

  async deleteFilter(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=delete-filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Xóa bộ lọc thất bại');
  }

  async listPackages(): Promise<{ ok: boolean; packages: SelfBoothPackage[] }> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=list-packages`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error('Không thể tải gói chụp');
    return data;
  }

  async createPackage(pkg: Partial<SelfBoothPackage>): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=create-package`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pkg)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Tạo gói chụp thất bại');
  }

  async updatePackage(pkg: Partial<SelfBoothPackage>): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=update-package`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pkg)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Cập nhật gói thất bại');
  }

  async getSettings(): Promise<{ ok: boolean; settings: Record<string, string> }> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=get-settings`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error('Không thể tải cấu hình');
    return data;
  }

  async updateSettings(settings: Record<string, string>): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/selfbooth-admin?action=update-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Lưu cấu hình thất bại');
  }
}
