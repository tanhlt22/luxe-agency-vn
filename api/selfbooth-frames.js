import { callWorkerApi, setCors } from './_worker-client.js';

export const DEFAULT_FRAMES = [
  {
    id: 'frame_strip_2',
    name: 'Khung 2 Dải Ảnh (Classic 2-Strip)',
    category: 'strip',
    aspect_ratio: '2x6',
    width: 600,
    height: 1800,
    slot_count: 3,
    slots_json: JSON.stringify([
      { index: 0, x: 40, y: 80, width: 520, height: 480, rotation: 0 },
      { index: 1, x: 40, y: 590, width: 520, height: 480, rotation: 0 },
      { index: 2, x: 40, y: 1100, width: 520, height: 480, rotation: 0 }
    ]),
    image_url: '',
    frame_color: '#FFFFFF',
    border_radius: 12,
    footer_text: 'TÁCH TÁCH PHOTOBOOTH • SELF-STUDIO',
    is_active: 1,
    display_order: 1
  },
  {
    id: 'frame_grid_4',
    name: 'Khung 4 Ô Vuông (4-Grid)',
    category: 'grid',
    aspect_ratio: '4x6',
    width: 1200,
    height: 1800,
    slot_count: 4,
    slots_json: JSON.stringify([
      { index: 0, x: 60, y: 120, width: 510, height: 680, rotation: 0 },
      { index: 1, x: 630, y: 120, width: 510, height: 680, rotation: 0 },
      { index: 2, x: 60, y: 840, width: 510, height: 680, rotation: 0 },
      { index: 3, x: 630, y: 840, width: 510, height: 680, rotation: 0 }
    ]),
    image_url: '',
    frame_color: '#FAF6F0',
    border_radius: 16,
    footer_text: 'LUMIBOOTH VINTAGE MOMENTS',
    is_active: 1,
    display_order: 2
  },
  {
    id: 'frame_grid_6',
    name: 'Khung 6 Ô Nghệ Thuật (6-Grid)',
    category: 'grid',
    aspect_ratio: '4x6',
    width: 1200,
    height: 1800,
    slot_count: 6,
    slots_json: JSON.stringify([
      { index: 0, x: 60, y: 100, width: 510, height: 460, rotation: 0 },
      { index: 1, x: 630, y: 100, width: 510, height: 460, rotation: 0 },
      { index: 2, x: 60, y: 600, width: 510, height: 460, rotation: 0 },
      { index: 3, x: 630, y: 600, width: 510, height: 460, rotation: 0 },
      { index: 4, x: 60, y: 1100, width: 510, height: 460, rotation: 0 },
      { index: 5, x: 630, y: 1100, width: 510, height: 460, rotation: 0 }
    ]),
    image_url: '',
    frame_color: '#FDFBF7',
    border_radius: 12,
    footer_text: 'SWEET MEMORIES WITH FRIENDS',
    is_active: 1,
    display_order: 3
  },
  {
    id: 'frame_single_1',
    name: 'Khung Đơn Nghệ Thuật (1-Single Master)',
    category: 'single',
    aspect_ratio: '4x6',
    width: 1200,
    height: 1800,
    slot_count: 1,
    slots_json: JSON.stringify([
      { index: 0, x: 80, y: 120, width: 1040, height: 1440, rotation: 0 }
    ]),
    image_url: '',
    frame_color: '#FFFFFF',
    border_radius: 20,
    footer_text: 'PORTRAIT STUDIO MASTER',
    is_active: 1,
    display_order: 4
  }
];

export const DEFAULT_FILTERS = [
  { id: 'filter_original', name: 'Gốc (Original)', css_filter: 'none', is_active: 1, display_order: 1 },
  { id: 'filter_bw', name: 'Đen Trắng (B&W Studio)', css_filter: 'grayscale(100%) contrast(115%)', is_active: 1, display_order: 2 },
  { id: 'filter_vintage', name: 'Vintage 1980s', css_filter: 'sepia(35%) contrast(108%) saturate(120%) brightness(102%)', is_active: 1, display_order: 3 },
  { id: 'filter_warm', name: 'Nắng Ấm (Warm Sun)', css_filter: 'sepia(20%) saturate(135%) brightness(105%)', is_active: 1, display_order: 4 },
  { id: 'filter_cyberpunk', name: 'Cyberpunk Cool', css_filter: 'hue-rotate(185deg) saturate(140%) contrast(110%)', is_active: 1, display_order: 5 },
  { id: 'filter_film', name: 'Hạt Phim (Film Classic)', css_filter: 'contrast(120%) brightness(95%) saturate(85%)', is_active: 1, display_order: 6 },
  { id: 'filter_soft_glow', name: 'Mộng Mơ (Soft Glow)', css_filter: 'brightness(110%) contrast(95%) saturate(110%)', is_active: 1, display_order: 7 },
  { id: 'filter_pastel', name: 'Pastel Hàn Quốc', css_filter: 'brightness(108%) contrast(90%) saturate(125%) hue-rotate(-5deg)', is_active: 1, display_order: 8 }
];

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    let frames = [];
    let filters = [];

    try {
      const [framesRes, filtersRes] = await Promise.all([
        callWorkerApi('/v1/selfbooth/frames'),
        callWorkerApi('/v1/selfbooth/filters')
      ]);

      if (framesRes.ok) {
        const framesData = await framesRes.json();
        frames = framesData.frames || [];
      }
      if (filtersRes.ok) {
        const filtersData = await filtersRes.json();
        filters = filtersData.filters || [];
      }
    } catch {
      // Worker offline / fallback
    }

    if (!frames || frames.length === 0) {
      frames = DEFAULT_FRAMES;
    }
    if (!filters || filters.length === 0) {
      filters = DEFAULT_FILTERS;
    }

    res.status(200).json({
      ok: true,
      frames,
      filters
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch frames and filters',
      message: error.message
    });
  }
}
