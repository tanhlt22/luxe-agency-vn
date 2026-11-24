import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { jsPDF } from 'jspdf';
import { SelfBoothService } from '../services/selfbooth.service';
import {
  WebFrame,
  WebColorFilter,
  WebFrameSlot,
  SlotImageTransform,
  SelfBoothTicket
} from '../models/selfbooth.models';

export interface ComposerPhoto {
  id: string;
  url: string;
  name?: string;
  source: 'session' | 'upload';
}

@Component({
  selector: 'app-selfbooth-composer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './selfbooth-composer.html',
  styleUrls: ['./selfbooth-composer.scss']
})
export class SelfBoothComposerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('previewCanvas') previewCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  // Routing params
  ticketCode = signal<string>('');
  sessionCode = signal<string>('');
  ticket = signal<SelfBoothTicket | null>(null);

  // Catalog
  frames = signal<WebFrame[]>([]);
  filters = signal<WebColorFilter[]>([]);
  activeFrame = signal<WebFrame | null>(null);
  activeSlots = signal<WebFrameSlot[]>([]);

  // Photos Tray (Dual sources: session + upload)
  trayPhotos = signal<ComposerPhoto[]>([]);
  activeSlotIndex = signal<number>(0);

  // Slot Transforms map (slotIndex -> SlotImageTransform)
  slotTransforms = signal<Map<number, SlotImageTransform>>(new Map());

  // Current slot active controls
  currentZoom = signal<number>(1.0);
  currentRotation = signal<number>(0);
  currentFlipH = signal<boolean>(false);
  currentFlipV = signal<boolean>(false);
  currentFilterId = signal<string>('filter_original');

  // Status & Progress
  isLoading = signal<boolean>(true);
  isRendering = signal<boolean>(false);
  isSubmittingPrint = signal<boolean>(false);
  printSubmitSuccess = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  exportDpi = signal<300 | 600>(300);

  // Gesture State
  private isPointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private initialPinchDistance = 0;
  private initialPinchZoom = 1.0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private selfBoothService: SelfBoothService
  ) {}

  async ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const t = params.get('ticket') || '';
      const s = params.get('session') || '';
      this.ticketCode.set(t);
      this.sessionCode.set(s);
    });

    await this.loadCatalogAndData();
  }

  ngAfterViewInit() {
    this.setupTouchGestures();
    setTimeout(() => this.redrawCanvas(), 100);
  }

  ngOnDestroy() {
    // cleanup
  }

  private async loadCatalogAndData() {
    this.isLoading.set(true);
    try {
      // 1. Tải frames và filters
      const catalog = await this.selfBoothService.getFramesAndFilters();
      this.frames.set(catalog.frames);
      this.filters.set(catalog.filters);

      if (catalog.frames.length > 0) {
        this.selectFrame(catalog.frames[0]);
      }

      // 2. Tra cứu thông tin vé nếu có
      if (this.ticketCode()) {
        try {
          const ticketData = await this.selfBoothService.getTicket(this.ticketCode());
          this.ticket.set(ticketData.ticket);
        } catch {
          // Cho phép tiếp tục ngay cả khi vé offline
        }
      }

      // 3. Nạp ảnh từ phiên chụp
      await this.loadSessionPhotos();
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Lỗi khi tải dữ liệu ghép khung');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadSessionPhotos() {
    const sCode = this.sessionCode() || (this.ticket()?.session_code || '');
    let sessionPhotos: ComposerPhoto[] = [];

    if (sCode) {
      const items = await this.selfBoothService.fetchSessionPhotos(sCode);
      if (items && items.length > 0) {
        sessionPhotos = items.map((it: any, i: number) => ({
          id: it.mediaId || `ses_${i}`,
          url: it.lightboxUrl || it.mediaUrl || it.thumbnailUrl,
          name: it.name || `Ảnh ${i + 1}`,
          source: 'session' as const
        }));
      }
    }

    // Nếu không lấy được từ Worker/Drive, thử đọc ảnh đã truyền từ EventGallery qua sessionStorage
    if (sessionPhotos.length === 0) {
      try {
        const cachedRaw = sessionStorage.getItem('sb_session_photos');
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            sessionPhotos = parsed.map((it: any, i: number) => ({
              id: it.id || `ses_cache_${i}`,
              url: it.url,
              name: it.name || `Ảnh ${i + 1}`,
              source: 'session' as const
            })).filter((it: ComposerPhoto) => Boolean(it.url));
          }
        }
      } catch {
        // Ignore sessionStorage parse/access issues
      }
    }

    // Nếu chưa có ảnh từ phiên, cung cấp ảnh demo mẫu chất lượng cao
    if (sessionPhotos.length === 0) {
      sessionPhotos = [
        { id: 'sample_1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80', name: 'Chân dung Studio 1', source: 'session' },
        { id: 'sample_2', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80', name: 'Nụ cười tươi 2', source: 'session' },
        { id: 'sample_3', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80', name: 'Tạo dáng tự nhiên 3', source: 'session' },
        { id: 'sample_4', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80', name: 'Góc nghiêng 4', source: 'session' }
      ];
    }

    this.trayPhotos.set(sessionPhotos);

    // Tự động gán các ảnh đầu tiên vào các ô slot của khung
    const slots = this.activeSlots();
    for (let i = 0; i < slots.length && i < sessionPhotos.length; i++) {
      await this.assignPhotoToSlot(sessionPhotos[i], i, false);
    }
    this.redrawCanvas();
  }

  selectFrame(frame: WebFrame) {
    this.activeFrame.set(frame);
    let slots: WebFrameSlot[] = [];
    try {
      slots = JSON.parse(frame.slots_json);
    } catch {
      slots = [];
    }
    this.activeSlots.set(slots);
    this.activeSlotIndex.set(0);

    // Điều chỉnh lại slotTransforms cho vừa với số lượng slots mới
    const currentMap = this.slotTransforms();
    const newMap = new Map<number, SlotImageTransform>();
    for (let i = 0; i < slots.length; i++) {
      if (currentMap.has(i)) {
        const existing = currentMap.get(i)!;
        newMap.set(i, existing);
      }
    }
    this.slotTransforms.set(newMap);
    this.updateControlsFromSlot(0);
    this.redrawCanvas();
  }

  selectSlot(index: number) {
    if (index >= 0 && index < this.activeSlots().length) {
      this.activeSlotIndex.set(index);
      this.updateControlsFromSlot(index);
      this.redrawCanvas();
    }
  }

  private updateControlsFromSlot(slotIdx: number) {
    const t = this.slotTransforms().get(slotIdx);
    if (t) {
      this.currentZoom.set(t.userZoom);
      this.currentRotation.set(t.rotation);
      this.currentFlipH.set(t.flipH);
      this.currentFlipV.set(t.flipV);
      this.currentFilterId.set(t.filterId);
    } else {
      this.currentZoom.set(1.0);
      this.currentRotation.set(0);
      this.currentFlipH.set(false);
      this.currentFlipV.set(false);
      this.currentFilterId.set('filter_original');
    }
  }

  async assignPhotoToSlot(photo: ComposerPhoto, slotIdx: number, triggerRedraw = true) {
    const slots = this.activeSlots();
    if (slotIdx < 0 || slotIdx >= slots.length) return;
    const slot = slots[slotIdx];

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => {
        // Fallback placeholder image nếu CORS bị chặn
        img.src = photo.url;
        resolve();
      };
      img.src = photo.url;
    });

    const imgW = img.naturalWidth || slot.width;
    const imgH = img.naturalHeight || slot.height;

    // Toán học minScale cover floor: đảm bảo ảnh phủ kín ô slot
    const scaleCover = Math.max(slot.width / imgW, slot.height / imgH);

    const transform: SlotImageTransform = {
      img,
      url: photo.url,
      scaleCover,
      userZoom: 1.0,
      panX: 0,
      panY: 0,
      rotation: 0,
      flipH: false,
      flipV: false,
      filterId: this.currentFilterId() || 'filter_original'
    };

    const map = new Map(this.slotTransforms());
    map.set(slotIdx, transform);
    this.slotTransforms.set(map);

    this.updateControlsFromSlot(slotIdx);

    if (triggerRedraw) {
      this.redrawCanvas();
    }
  }

  onTrayPhotoClick(photo: ComposerPhoto) {
    const slotIdx = this.activeSlotIndex();
    this.assignPhotoToSlot(photo, slotIdx, true);
  }

  triggerUpload() {
    this.fileInputRef?.nativeElement?.click();
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    const newPhotos: ComposerPhoto[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = URL.createObjectURL(file);
      newPhotos.push({
        id: `upload_${Date.now()}_${i}`,
        url,
        name: file.name,
        source: 'upload'
      });
    }

    this.trayPhotos.set([...newPhotos, ...this.trayPhotos()]);
    if (newPhotos.length > 0) {
      this.assignPhotoToSlot(newPhotos[0], this.activeSlotIndex(), true);
    }
    input.value = '';
  }

  // ===== TRANSFORM CONTROLS =====

  onZoomChange(zoomVal: number) {
    this.currentZoom.set(zoomVal);
    const slotIdx = this.activeSlotIndex();
    const t = this.slotTransforms().get(slotIdx);
    const slot = this.activeSlots()[slotIdx];
    if (t && slot && t.img) {
      t.userZoom = zoomVal;
      // Clamp lại pan để tránh hở viền khi thu nhỏ
      this.clampPan(t, slot);
      this.redrawCanvas();
    }
  }

  onRotationChange(rotVal: number) {
    this.currentRotation.set(rotVal);
    const slotIdx = this.activeSlotIndex();
    const t = this.slotTransforms().get(slotIdx);
    if (t) {
      t.rotation = rotVal;
      this.redrawCanvas();
    }
  }

  toggleFlipH() {
    const newFlip = !this.currentFlipH();
    this.currentFlipH.set(newFlip);
    const slotIdx = this.activeSlotIndex();
    const t = this.slotTransforms().get(slotIdx);
    if (t) {
      t.flipH = newFlip;
      this.redrawCanvas();
    }
  }

  toggleFlipV() {
    const newFlip = !this.currentFlipV();
    this.currentFlipV.set(newFlip);
    const slotIdx = this.activeSlotIndex();
    const t = this.slotTransforms().get(slotIdx);
    if (t) {
      t.flipV = newFlip;
      this.redrawCanvas();
    }
  }

  resetSlotTransform() {
    this.currentZoom.set(1.0);
    this.currentRotation.set(0);
    this.currentFlipH.set(false);
    this.currentFlipV.set(false);
    this.currentFilterId.set('filter_original');

    const slotIdx = this.activeSlotIndex();
    const t = this.slotTransforms().get(slotIdx);
    if (t) {
      t.userZoom = 1.0;
      t.panX = 0;
      t.panY = 0;
      t.rotation = 0;
      t.flipH = false;
      t.flipV = false;
      t.filterId = 'filter_original';
      this.redrawCanvas();
    }
  }

  applyFilter(filter: WebColorFilter, applyToAll = false) {
    this.currentFilterId.set(filter.id);
    const map = new Map(this.slotTransforms());

    if (applyToAll) {
      for (const [idx, t] of map.entries()) {
        t.filterId = filter.id;
      }
    } else {
      const t = map.get(this.activeSlotIndex());
      if (t) t.filterId = filter.id;
    }

    this.slotTransforms.set(map);
    this.redrawCanvas();
  }

  private clampPan(t: SlotImageTransform, slot: WebFrameSlot) {
    if (!t.img) return;
    const imgW = t.img.naturalWidth || slot.width;
    const imgH = t.img.naturalHeight || slot.height;
    const effectiveScale = t.scaleCover * t.userZoom;

    const maxPanX = Math.max(0, (imgW * effectiveScale - slot.width) / 2);
    const maxPanY = Math.max(0, (imgH * effectiveScale - slot.height) / 2);

    t.panX = Math.max(-maxPanX, Math.min(maxPanX, t.panX));
    t.panY = Math.max(-maxPanY, Math.min(maxPanY, t.panY));
  }

  // ===== TOUCH & POINTER GESTURES =====

  private setupTouchGestures() {
    const canvas = this.previewCanvasRef?.nativeElement;
    if (!canvas) return;

    // Pointer events (Desktop & Mobile)
    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      this.isPointerDown = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      canvas.setPointerCapture(e.pointerId);

      // Nhận diện click chọn ô slot nếu chạm vào ô slot
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;

      const slots = this.activeSlots();
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (canvasX >= s.x && canvasX <= s.x + s.width && canvasY >= s.y && canvasY <= s.y + s.height) {
          this.selectSlot(i);
          break;
        }
      }
    });

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isPointerDown) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      const rect = canvas.getBoundingClientRect();
      const scaleRatio = canvas.width / rect.width;

      const slotIdx = this.activeSlotIndex();
      const t = this.slotTransforms().get(slotIdx);
      const slot = this.activeSlots()[slotIdx];
      if (t && slot) {
        t.panX += dx * scaleRatio;
        t.panY += dy * scaleRatio;
        this.clampPan(t, slot);
        this.redrawCanvas();
      }
    });

    const pointerUp = (e: PointerEvent) => {
      this.isPointerDown = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    };

    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);

    // Two-finger Pinch-to-zoom on Mobile Touch
    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const p1 = e.touches[0];
        const p2 = e.touches[1];
        this.initialPinchDistance = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
        this.initialPinchZoom = this.currentZoom();
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e: TouchEvent) => {
      if (e.touches.length === 2 && this.initialPinchDistance > 0) {
        const p1 = e.touches[0];
        const p2 = e.touches[1];
        const currentDist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
        const factor = currentDist / this.initialPinchDistance;
        const newZoom = Math.max(1.0, Math.min(5.0, this.initialPinchZoom * factor));
        this.onZoomChange(Math.round(newZoom * 100) / 100);
      }
    }, { passive: true });
  }

  // ===== CANVAS RENDERING ENGINE =====

  redrawCanvas() {
    const canvas = this.previewCanvasRef?.nativeElement;
    const frame = this.activeFrame();
    if (!canvas || !frame) return;

    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.renderFrameScene(ctx, frame, 1.0, true);
  }

  private renderFrameScene(
    ctx: CanvasRenderingContext2D,
    frame: WebFrame,
    scaleFactor: number,
    drawActiveIndicator: boolean
  ) {
    const totalW = frame.width * scaleFactor;
    const totalH = frame.height * scaleFactor;

    // 1. Nền khung (Frame background)
    ctx.fillStyle = frame.frame_color || '#FAF6F0';
    ctx.fillRect(0, 0, totalW, totalH);

    // 2. Render từng slot ảnh
    const slots = this.activeSlots();
    const transforms = this.slotTransforms();

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const sx = slot.x * scaleFactor;
      const sy = slot.y * scaleFactor;
      const sw = slot.width * scaleFactor;
      const sh = slot.height * scaleFactor;
      const radius = (frame.border_radius || 12) * scaleFactor;

      ctx.save();

      // Clip bo góc ô slot
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(sx, sy, sw, sh, radius);
      } else {
        ctx.rect(sx, sy, sw, sh);
      }
      ctx.clip();

      const t = transforms.get(i);
      if (t && t.img) {
        const imgW = t.img.naturalWidth || slot.width;
        const imgH = t.img.naturalHeight || slot.height;
        const effectiveScale = t.scaleCover * t.userZoom * scaleFactor;

        // Áp dụng bộ lọc màu
        const filterObj = this.filters().find(f => f.id === t.filterId);
        if (filterObj && filterObj.css_filter && filterObj.css_filter !== 'none') {
          ctx.filter = filterObj.css_filter;
        } else {
          ctx.filter = 'none';
        }

        // Tọa độ tâm slot
        const centerX = sx + sw / 2 + t.panX * scaleFactor;
        const centerY = sy + sh / 2 + t.panY * scaleFactor;

        ctx.translate(centerX, centerY);

        if (t.rotation !== 0) {
          ctx.rotate((t.rotation * Math.PI) / 180);
        }

        const scaleX = t.flipH ? -1 : 1;
        const scaleY = t.flipV ? -1 : 1;
        ctx.scale(scaleX, scaleY);

        const drawW = imgW * effectiveScale;
        const drawH = imgH * effectiveScale;

        ctx.drawImage(t.img, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        // Slot trống chưa có ảnh
        ctx.fillStyle = '#E5E7EB';
        ctx.fillRect(sx, sy, sw, sh);
        ctx.fillStyle = '#9CA3AF';
        ctx.font = `${Math.round(24 * scaleFactor)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`+ Ô Ảnh ${i + 1}`, sx + sw / 2, sy + sh / 2);
      }

      ctx.restore();

      // Viền slot nếu là slot đang được chọn
      if (drawActiveIndicator && i === this.activeSlotIndex()) {
        ctx.save();
        ctx.strokeStyle = '#B76E79';
        ctx.lineWidth = 4 * scaleFactor;
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.restore();
      }
    }

    // 3. Footer branding text / Lớp trang trí viền khung
    ctx.save();
    ctx.fillStyle = '#814C53';
    ctx.font = `600 ${Math.round(18 * scaleFactor)}px 'Noto Serif', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const footer = frame.footer_text || 'TÁCH TÁCH PHOTOBOOTH • SELF-STUDIO';
    ctx.fillText(footer, totalW / 2, totalH - 35 * scaleFactor);
    ctx.restore();
  }

  // ===== HIGH-RES RENDERING & EXPORTS =====

  private createHighResCanvas(dpi: 300 | 600 = 300): HTMLCanvasElement {
    const frame = this.activeFrame();
    if (!frame) throw new Error('Chưa chọn khung ảnh');

    const scale = dpi === 600 ? 2.0 : 1.0;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(frame.width * scale);
    canvas.height = Math.round(frame.height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Không thể khởi tạo Canvas Context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    this.renderFrameScene(ctx, frame, scale, false);
    return canvas;
  }

  async exportPng() {
    this.isRendering.set(true);
    try {
      const canvas = this.createHighResCanvas(this.exportDpi());
      const dataUrl = canvas.toDataURL('image/png', 1.0);

      const link = document.createElement('a');
      link.download = `selfbooth_master_${this.ticketCode() || 'photo'}_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      alert(`Xuất file PNG thất bại: ${err.message}`);
    } finally {
      this.isRendering.set(false);
    }
  }

  async exportPdf() {
    this.isRendering.set(true);
    try {
      const frame = this.activeFrame();
      if (!frame) return;

      const canvas = this.createHighResCanvas(300);
      const dataUrl = canvas.toDataURL('image/png', 1.0);

      // Kích thước in chuẩn tính theo inch:
      // 4x6 inch: width 4, height 6 (hoặc ngược lại tùy aspect_ratio)
      // 2x6 inch: width 2, height 6
      const isStrip = frame.aspect_ratio === '2x6';
      const pdfW = isStrip ? 2 : 4;
      const pdfH = 6;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [pdfW, pdfH]
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfW, pdfH, undefined, 'FAST');
      pdf.save(`selfbooth_print_${this.ticketCode() || 'sheet'}_${Date.now()}.pdf`);
    } catch (err: any) {
      alert(`Xuất file PDF thất bại: ${err.message}`);
    } finally {
      this.isRendering.set(false);
    }
  }

  async submitToPrint() {
    const tCode = this.ticketCode();
    if (!tCode) {
      alert('Vui lòng nhập hoặc kiểm tra mã vé trước khi gửi in.');
      return;
    }

    this.isSubmittingPrint.set(true);
    this.printSubmitSuccess.set(null);
    this.errorMessage.set(null);

    try {
      const canvas = this.createHighResCanvas(300);
      const base64Data = canvas.toDataURL('image/png', 0.95);

      const res = await this.selfBoothService.submitPrintOrder({
        ticketCode: tCode,
        copies: 1,
        fileBase64: base64Data,
        source: 'WEB_COMPOSE'
      });

      this.printSubmitSuccess.set(
        `Đã gửi in thành công! Mã đơn #${res.orderId.substring(0, 8)}. Bạn còn ${res.printsRemaining} bản in trong vé.`
      );
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Gửi lệnh in thất bại. Vui lòng kiểm tra hạn mức vé.');
    } finally {
      this.isSubmittingPrint.set(false);
    }
  }
}
