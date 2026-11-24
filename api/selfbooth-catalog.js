import { callWorkerApi, setCors } from './_worker-client.js';

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
    const workerRes = await callWorkerApi('/v1/selfbooth/packages');
    let packages = [];
    if (workerRes.ok) {
      const data = await workerRes.json();
      packages = data.packages || [];
    }

    if (!packages || packages.length === 0) {
      // Fallback 4 standard packages if worker has not yet completed migration seed
      packages = [
        {
          id: 'pkg_15',
          name: 'Gói Mini 15 Phút',
          duration_minutes: 15,
          price: 99000,
          print_quota: 2,
          description: 'Trải nghiệm chụp nhanh, nhận 2 ảnh in chất lượng cao.',
          is_active: 1,
          display_order: 1
        },
        {
          id: 'pkg_30',
          name: 'Gói Chuẩn 30 Phút',
          duration_minutes: 30,
          price: 179000,
          print_quota: 4,
          description: 'Lựa chọn phổ biến nhất! Thỏa sức tạo dáng, nhận 4 ảnh in.',
          is_active: 1,
          display_order: 2
        },
        {
          id: 'pkg_45',
          name: 'Gói Nâng Cao 45 Phút',
          duration_minutes: 45,
          price: 249000,
          print_quota: 6,
          description: 'Dành cho nhóm bạn & gia đình, nhận 6 ảnh in kỷ niệm.',
          is_active: 1,
          display_order: 3
        },
        {
          id: 'pkg_60',
          name: 'Gói VIP 60 Phút',
          duration_minutes: 60,
          price: 319000,
          print_quota: 8,
          description: 'Không gian riêng tư trọn vẹn, nhận 8 ảnh in sắc nét.',
          is_active: 1,
          display_order: 4
        }
      ];
    }

    const stores = [
      {
        id: 'store_hp_01',
        name: 'Tách Tách Studio — Hải Phòng',
        address: 'Số 123 Lạch Tray, Ngô Quyền, Hải Phòng',
        booths: [
          { id: 'booth_hp_01', name: 'Phòng Booth 01 (Tone Pastel)' },
          { id: 'booth_hp_02', name: 'Phòng Booth 02 (Tone Classic)' }
        ]
      }
    ];

    res.status(200).json({
      ok: true,
      packages,
      stores
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch catalog',
      message: error.message
    });
  }
}
