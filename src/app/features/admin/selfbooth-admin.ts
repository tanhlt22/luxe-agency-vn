import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SelfBoothAdminService } from './services/selfbooth-admin.service';
import {
  SelfBoothTicket,
  WebPrintOrder,
  WebFrame,
  WebColorFilter,
  SelfBoothPackage
} from '../selfbooth/models/selfbooth.models';

type AdminTab = 'TICKETS_QUEUE' | 'PRINT_QUEUE' | 'WAREHOUSE_SETTINGS';
type WarehouseSubTab = 'FRAMES' | 'FILTERS' | 'PACKAGES' | 'SEPAY';

@Component({
  selector: 'app-selfbooth-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './selfbooth-admin.html',
  styleUrls: ['./selfbooth-admin.scss']
})
export class SelfBoothAdminComponent implements OnInit, OnDestroy {
  // Authentication
  isAuthenticated = signal<boolean>(false);
  pinInput = signal<string>('');
  loginError = signal<string | null>(null);
  staffInfo = signal<any>(null);

  // Tabs
  currentTab = signal<AdminTab>('TICKETS_QUEUE');
  currentWarehouseSubTab = signal<WarehouseSubTab>('FRAMES');

  // Tab 1: Tickets & Queue
  tickets = signal<SelfBoothTicket[]>([]);
  ticketSearch = signal<string>('');
  ticketStatusFilter = signal<string>('');
  isLoadingTickets = signal<boolean>(false);
  newTicketPackageId = signal<string>('pkg_30');
  newTicketCustomerName = signal<string>('');
  newTicketCustomerPhone = signal<string>('');
  newTicketPaymentMethod = signal<string>('CASH');
  selectedTicketDetail = signal<SelfBoothTicket | null>(null);
  issuedTicketCode = signal<string | null>(null);

  // Tab 2: Print Queue
  printOrders = signal<WebPrintOrder[]>([]);
  isAutoPrintEnabled = signal<boolean>(false);
  isLoadingOrders = signal<boolean>(false);

  // Tab 3: Warehouse & Settings
  frames = signal<WebFrame[]>([]);
  filters = signal<WebColorFilter[]>([]);
  packages = signal<SelfBoothPackage[]>([]);
  settings = signal<Record<string, string>>({});
  isLoadingWarehouse = signal<boolean>(false);

  // Form edit modal / fields
  editingFrame = signal<Partial<WebFrame> | null>(null);
  editingFilter = signal<Partial<WebColorFilter> | null>(null);
  editingPackage = signal<Partial<SelfBoothPackage> | null>(null);

  // SePay Config Form
  sepayBankName = signal<string>('MBBank');
  sepayAccountNumber = signal<string>('');
  sepayAccountHolder = signal<string>('');
  sepayApiKey = signal<string>('');
  sepayWebhookSecret = signal<string>('');
  saveSettingsSuccess = signal<boolean>(false);

  private pollIntervalId: any = null;

  constructor(
    private adminService: SelfBoothAdminService,
    private router: Router
  ) {}

  async ngOnInit() {
    // Check saved auto-print preference
    const savedAutoPrint = localStorage.getItem('sb_autoprint_enabled');
    if (savedAutoPrint === 'true') {
      this.isAutoPrintEnabled.set(true);
    }

    const auth = await this.adminService.checkAuth();
    if (auth.ok) {
      this.isAuthenticated.set(true);
      this.staffInfo.set(auth.staff);
      this.loadTabData();
      this.startPolling();
    }
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  private startPolling() {
    this.stopPolling();
    this.pollIntervalId = setInterval(() => {
      if (this.isAuthenticated() && !document.hidden) {
        if (this.currentTab() === 'TICKETS_QUEUE') {
          this.loadTickets(false);
        } else if (this.currentTab() === 'PRINT_QUEUE') {
          this.loadPrintOrders(false);
        }
      }
    }, 5000);
  }

  private stopPolling() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  // ===== AUTHENTICATION =====

  async handleLogin() {
    const pin = this.pinInput().trim();
    if (!pin) {
      this.loginError.set('Vui lòng nhập mã PIN');
      return;
    }

    try {
      this.loginError.set(null);
      const res = await this.adminService.login(pin);
      this.isAuthenticated.set(true);
      this.staffInfo.set(res.staff);
      this.loadTabData();
      this.startPolling();
    } catch (err: any) {
      this.loginError.set(err.message || 'Mã PIN không đúng');
    }
  }

  async handleLogout() {
    await this.adminService.logout();
    this.isAuthenticated.set(false);
    this.staffInfo.set(null);
    this.stopPolling();
  }

  switchTab(tab: AdminTab) {
    this.currentTab.set(tab);
    this.loadTabData();
  }

  loadTabData() {
    const tab = this.currentTab();
    if (tab === 'TICKETS_QUEUE') {
      this.loadTickets();
    } else if (tab === 'PRINT_QUEUE') {
      this.loadPrintOrders();
    } else if (tab === 'WAREHOUSE_SETTINGS') {
      this.loadWarehouseData();
    }
  }

  // ===== TAB 1: TICKETS & QUEUE =====

  async loadTickets(showLoader = true) {
    if (showLoader) this.isLoadingTickets.set(true);
    try {
      const res = await this.adminService.listTickets({
        search: this.ticketSearch(),
        status: this.ticketStatusFilter()
      });
      this.tickets.set(res.tickets || []);
    } catch {
      //
    } finally {
      if (showLoader) this.isLoadingTickets.set(false);
    }
  }

  async handleIssueTicket() {
    try {
      const res = await this.adminService.issueTicket({
        packageId: this.newTicketPackageId(),
        customerName: this.newTicketCustomerName().trim() || 'Khách Tại Quầy',
        customerPhone: this.newTicketCustomerPhone().trim() || undefined,
        paymentMethod: this.newTicketPaymentMethod(),
        confirmNow: this.newTicketPaymentMethod() === 'CASH'
      });

      this.issuedTicketCode.set(res.ticket.ticket_code);
      this.newTicketCustomerName.set('');
      this.newTicketCustomerPhone.set('');
      this.loadTickets(false);
    } catch (err: any) {
      alert(`Phát vé thất bại: ${err.message}`);
    }
  }

  async confirmPayment(ticket: SelfBoothTicket) {
    if (!confirm(`Xác nhận thu tiền cho vé #${ticket.ticket_code}?`)) return;
    try {
      await this.adminService.confirmPayment(ticket.id);
      this.loadTickets(false);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async cancelTicket(ticket: SelfBoothTicket) {
    if (!confirm(`Bạn có chắc chắn muốn hủy vé #${ticket.ticket_code}?`)) return;
    try {
      await this.adminService.cancelTicket(ticket.id);
      this.loadTickets(false);
    } catch (err: any) {
      alert(err.message);
    }
  }

  printBrowserTicket(ticket: SelfBoothTicket) {
    const printWindow = window.open('', '_blank', 'width=350,height=500');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Vé Chụp #${ticket.ticket_code}</title>
          <style>
            body { font-family: monospace; text-align: center; padding: 20px; }
            .code { font-size: 32px; font-weight: bold; letter-spacing: 4px; margin: 15px 0; border: 2px dashed #000; padding: 10px; }
            .info { font-size: 13px; margin: 5px 0; }
          </style>
        </head>
        <body>
          <h3>TÁCH TÁCH PHOTOBOOTH</h3>
          <div class="code">${ticket.ticket_code}</div>
          <div class="info">Gói: ${ticket.package_name}</div>
          <div class="info">Thời gian: ${ticket.duration_minutes} phút</div>
          <div class="info">Hạn mức in: ${ticket.print_quota} ảnh</div>
          <div class="info">Khách hàng: ${ticket.customer_name || 'Khách lẻ'}</div>
          <div class="info">Ngày: ${new Date(ticket.created_at).toLocaleString('vi-VN')}</div>
          <p>---------------------------------</p>
          <p>Vui lòng nhập mã vé trên màn hình phòng chụp để bắt đầu.</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  // ===== TAB 2: CENTRAL PRINT QUEUE =====

  toggleAutoPrint() {
    const nextVal = !this.isAutoPrintEnabled();
    this.isAutoPrintEnabled.set(nextVal);
    localStorage.setItem('sb_autoprint_enabled', String(nextVal));
  }

  async loadPrintOrders(showLoader = true) {
    if (showLoader) this.isLoadingOrders.set(true);
    try {
      const res = await this.adminService.listPrintOrders();
      this.printOrders.set(res.orders || []);

      // Auto-print logic: nếu bật, kiểm tra đơn in mới ở trạng thái QUEUED
      if (this.isAutoPrintEnabled()) {
        const queuedOrders = (res.orders || []).filter(o => o.status === 'QUEUED');
        if (queuedOrders.length > 0) {
          // In đơn đầu tiên
          const first = queuedOrders[0];
          this.triggerBrowserPrint(first);
        }
      }
    } catch {
      //
    } finally {
      if (showLoader) this.isLoadingOrders.set(false);
    }
  }

  triggerBrowserPrint(order: WebPrintOrder) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>In Đơn #${order.id.substring(0, 8)}</title></head>
        <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;">
          <img src="${order.file_url}" style="max-width:100%;max-height:100%;" onload="window.print();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  async retryOrder(order: WebPrintOrder) {
    try {
      await this.adminService.retryPrintOrder(order.id);
      this.loadPrintOrders(false);
    } catch (err: any) {
      alert(err.message);
    }
  }

  // ===== TAB 3: WAREHOUSE & SETTINGS =====

  async loadWarehouseData() {
    this.isLoadingWarehouse.set(true);
    try {
      const [fRes, fltRes, pkgRes, setRes] = await Promise.all([
        this.adminService.listFrames(),
        this.adminService.listFilters(),
        this.adminService.listPackages(),
        this.adminService.getSettings()
      ]);

      this.frames.set(fRes.frames || []);
      this.filters.set(fltRes.filters || []);
      this.packages.set(pkgRes.packages || []);
      this.settings.set(setRes.settings || {});

      // Gán form SePay
      if (setRes.settings) {
        this.sepayBankName.set(setRes.settings['SEPAY_BANK_NAME'] || 'MBBank');
        this.sepayAccountNumber.set(setRes.settings['SEPAY_ACCOUNT_NUMBER'] || '');
        this.sepayAccountHolder.set(setRes.settings['SEPAY_ACCOUNT_HOLDER'] || '');
        this.sepayApiKey.set(setRes.settings['SEPAY_API_KEY'] || '');
        this.sepayWebhookSecret.set(setRes.settings['SEPAY_WEBHOOK_SECRET'] || '');
      }
    } catch {
      //
    } finally {
      this.isLoadingWarehouse.set(false);
    }
  }

  async saveSepaySettings() {
    try {
      this.saveSettingsSuccess.set(false);
      await this.adminService.updateSettings({
        SEPAY_BANK_NAME: this.sepayBankName(),
        SEPAY_ACCOUNT_NUMBER: this.sepayAccountNumber(),
        SEPAY_ACCOUNT_HOLDER: this.sepayAccountHolder(),
        SEPAY_API_KEY: this.sepayApiKey(),
        SEPAY_WEBHOOK_SECRET: this.sepayWebhookSecret()
      });
      this.saveSettingsSuccess.set(true);
      setTimeout(() => this.saveSettingsSuccess.set(false), 3000);
    } catch (err: any) {
      alert(`Lưu cấu hình thất bại: ${err.message}`);
    }
  }

  async toggleFrameActive(frame: WebFrame) {
    const nextState = frame.is_active ? 0 : 1;
    await this.adminService.updateFrame({ id: frame.id, is_active: nextState });
    this.loadWarehouseData();
  }

  async deleteFrame(frame: WebFrame) {
    if (!confirm(`Xóa khung ảnh "${frame.name}"?`)) return;
    await this.adminService.deleteFrame(frame.id);
    this.loadWarehouseData();
  }

  formatVnd(val: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  }
}
