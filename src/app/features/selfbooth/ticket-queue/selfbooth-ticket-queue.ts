import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SelfBoothService } from '../services/selfbooth.service';
import { SelfBoothTicket, QueueStatus, PaymentInfo } from '../models/selfbooth.models';

@Component({
  selector: 'app-selfbooth-ticket-queue',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './selfbooth-ticket-queue.html',
  styleUrls: ['./selfbooth-ticket-queue.scss']
})
export class SelfBoothTicketQueueComponent implements OnInit, OnDestroy {
  ticketCode = signal<string>('');
  ticket = signal<SelfBoothTicket | null>(null);
  queue = signal<QueueStatus>({
    aheadCount: 0,
    isYourTurn: false,
    estimatedWaitMinutes: 0,
    remainingSeconds: 0
  });
  printQuota = signal<{ total: number; used: number; remaining: number }>({
    total: 0,
    used: 0,
    remaining: 0
  });
  payment = signal<PaymentInfo | null>(null);

  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);
  hasPlayedTurnChime = signal<boolean>(false);

  private pollIntervalId: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private selfBoothService: SelfBoothService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const code = params.get('code');
      if (code) {
        this.ticketCode.set(code);
        this.loadTicketStatus();
        this.startPolling();
      } else {
        this.errorMessage.set('Mã vé không tồn tại');
        this.isLoading.set(false);
      }
    });
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  private startPolling() {
    this.stopPolling();
    this.pollIntervalId = setInterval(() => {
      if (this.ticketCode() && !document.hidden) {
        this.loadTicketStatus(false);
      }
    }, 3500);
  }

  private stopPolling() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  async loadTicketStatus(showLoader = true) {
    if (showLoader) this.isLoading.set(true);
    try {
      const res = await this.selfBoothService.getTicket(this.ticketCode());
      this.ticket.set(res.ticket);
      this.queue.set(res.queue);
      this.printQuota.set(res.printQuota);
      if (res.payment) this.payment.set(res.payment);

      // Kích hoạt chuông thông báo khi đến lượt hoặc khi đang trong phòng
      if (res.queue.isYourTurn && !this.hasPlayedTurnChime()) {
        this.playTurnNotificationChime();
        this.hasPlayedTurnChime.set(true);
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Không thể tra cứu thông tin vé.');
    } finally {
      if (showLoader) this.isLoading.set(false);
    }
  }

  playTurnNotificationChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {
      // Audio autoplay restrictions
    }
  }

  copyTicketCode() {
    const code = this.ticketCode();
    if (navigator?.clipboard && code) {
      navigator.clipboard.writeText(code);
      alert(`Đã sao chép mã vé: ${code}`);
    }
  }

  formatTime(seconds: number): string {
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  formatVnd(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }
}
