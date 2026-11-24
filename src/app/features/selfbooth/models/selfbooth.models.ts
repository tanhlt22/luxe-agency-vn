export interface SelfBoothPackage {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  print_quota: number;
  description?: string;
  is_active?: number;
  display_order?: number;
}

export interface SelfBoothTicket {
  id: string;
  ticket_code: string;
  reference_code: string;
  store_id: string;
  machine_id?: string | null;
  package_id: string;
  package_name: string;
  duration_minutes: number;
  print_quota: number;
  prints_used: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  amount: number;
  payment_method: string;
  payment_status: 'PENDING' | 'PAID' | 'REFUNDED';
  status: 'PENDING_PAYMENT' | 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  session_code?: string | null;
  session_start_time?: string | null;
  session_end_time?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueueStatus {
  aheadCount: number;
  isYourTurn: boolean;
  estimatedWaitMinutes: number;
  remainingSeconds: number;
}

export interface PaymentInfo {
  method: string;
  amount: number;
  referenceCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrUrl: string;
}

export interface WebFrameSlot {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface WebFrame {
  id: string;
  name: string;
  category: string;
  aspect_ratio: string;
  width: number;
  height: number;
  slot_count: number;
  slots_json: string;
  image_url?: string;
  frame_color?: string;
  border_radius?: number;
  footer_text?: string;
  is_active: number;
  display_order: number;
}

export interface WebColorFilter {
  id: string;
  name: string;
  css_filter: string;
  settings_json?: string;
  is_active: number;
  display_order: number;
}

export interface WebPrintOrder {
  id: string;
  ticket_id?: string;
  ticket_code: string;
  store_id?: string;
  machine_id?: string;
  source: string;
  file_url: string;
  r2_key?: string;
  copies: number;
  status: 'QUEUED' | 'CLAIMED' | 'PRINTING' | 'COMPLETED' | 'FAILED';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface SlotImageTransform {
  img: HTMLImageElement | null;
  url: string;
  scaleCover: number;
  userZoom: number; // 1.0 -> 5.0
  panX: number;
  panY: number;
  rotation: number; // -45 -> +45
  flipH: boolean;
  flipV: boolean;
  filterId: string;
}
