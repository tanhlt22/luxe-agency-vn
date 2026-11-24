import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SelfBoothService } from '../services/selfbooth.service';
import { SelfBoothPackage, PaymentInfo, SelfBoothTicket } from '../models/selfbooth.models';

@Component({
  selector: 'app-selfbooth-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './selfbooth-booking.html',
  styleUrls: ['./selfbooth-booking.scss']
})
export class SelfBoothBookingComponent implements OnInit, OnDestroy {
  packages = signal<SelfBoothPackage[]>([]);
  selectedPackage = signal<SelfBoothPackage | null>(null);

  stores = signal<any[]>([]);
  selectedStoreId = signal<string>('store_hp_01');
  selectedMachineId = signal<string>('booth_hp_01');

  customerName = signal<string>('');
  customerPhone = signal<string>('');
  paymentMethod = signal<'VIETQR_SEPAY' | 'CASH'>('VIETQR_SEPAY');

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Modal thanh toán
  showPaymentModal = signal<boolean>(false);
  activeTicket = signal<SelfBoothTicket | null>(null);
  activePayment = signal<PaymentInfo | null>(null);
  isCheckingPayment = signal<boolean>(false);
  paymentSuccess = signal<boolean>(false);

  private pollInterval: any = null;

  constructor(
    private selfBoothService: SelfBoothService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      this.isLoading.set(true);
      const data = await this.selfBoothService.getCatalog();
      this.packages.set(data.packages || []);
      this.stores.set(data.stores || []);

      // Mặc định chọn gói 30 phút hoặc gói đầu tiên
      const defaultPkg = data.packages.find(p => p.id === 'pkg_30') || data.packages[0] || null;
      this.selectedPackage.set(defaultPkg);

      if (data.stores && data.stores.length > 0) {
        this.selectedStoreId.set(data.stores[0].id);
        if (data.stores[0].booths?.length > 0) {
          this.selectedMachineId.set(data.stores[0].booths[0].id);
        }
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Lỗi khi tải danh mục');
    } finally {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    this.stopPaymentPolling();
  }

  selectPackage(pkg: SelfBoothPackage) {
    this.selectedPackage.set(pkg);
  }

  formatVnd(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  async handleBooking() {
    const pkg = this.selectedPackage();
    if (!pkg) {
      this.errorMessage.set('Vui lòng chọn một gói chụp');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const res = await this.selfBoothService.createTicket({
        packageId: pkg.id,
        storeId: this.selectedStoreId(),
        machineId: this.selectedMachineId(),
        customerName: this.customerName().trim() || 'Khách Hàng',
        customerPhone: this.customerPhone().trim() || undefined,
        paymentMethod: this.paymentMethod()
      });

      this.activeTicket.set(res.ticket);
      this.activePayment.set(res.payment);
      this.showPaymentModal.set(true);

      if (this.paymentMethod() === 'VIETQR_SEPAY') {
        this.startPaymentPolling(res.ticket.ticket_code);
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Đặt vé không thành công, vui lòng thử lại.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private startPaymentPolling(ticketCode: string) {
    this.stopPaymentPolling();
    this.isCheckingPayment.set(true);

    this.pollInterval = setInterval(async () => {
      try {
        const res = await this.selfBoothService.getTicket(ticketCode);
        if (res.ticket.payment_status === 'PAID' || res.ticket.status === 'WAITING') {
          this.paymentSuccess.set(true);
          this.stopPaymentPolling();

          // Chuyển trang sau 2 giây để khách thấy thông báo thành công
          setTimeout(() => {
            this.router.navigate(['/selfbooth/ticket', ticketCode]);
          }, 2000);
        }
      } catch {
        // Polling im lặng
      }
    }, 2500);
  }

  private stopPaymentPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isCheckingPayment.set(false);
  }

  closeModal() {
    this.stopPaymentPolling();
    this.showPaymentModal.set(false);
    const ticket = this.activeTicket();
    if (ticket) {
      this.router.navigate(['/selfbooth/ticket', ticket.ticket_code]);
    }
  }

  copyToClipboard(text: string, label: string) {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      alert(`Đã sao chép ${label}: ${text}`);
    }
  }
}
