import { callWorkerApi, setCors } from './_worker-client.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // POST: Gửi lệnh in mới từ Web Compose hoặc Admin
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const ticketCode = String(body.ticketCode || '').trim();
      const fileBase64 = body.fileBase64 || body.renderMasterBase64 || body.imageBase64;
      const copies = Number(body.copies) || 1;
      const storeId = body.storeId || 'store_hp_01';
      const machineId = body.machineId || null;
      const source = body.source || 'WEB_COMPOSE';

      if (!ticketCode) {
        res.status(400).json({ ok: false, error: 'Thiếu mã vé (ticketCode).' });
        return;
      }
      if (!fileBase64) {
        res.status(400).json({ ok: false, error: 'Thiếu dữ liệu ảnh in (fileBase64).' });
        return;
      }

      const workerRes = await callWorkerApi('/v1/selfbooth/print-orders', {
        method: 'POST',
        body: {
          ticketCode,
          copies,
          storeId,
          machineId,
          source,
          fileBase64,
          mimeType: 'image/png'
        }
      });

      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: 'Tạo lệnh in thất bại',
        message: error.message
      });
    }
    return;
  }

  // GET: Tra cứu file hoặc thông tin đơn in
  if (req.method === 'GET') {
    const orderId = req.query?.orderId || req.query?.id;
    if (orderId && req.query?.file === '1') {
      try {
        const fileRes = await callWorkerApi(`/v1/selfbooth/print-orders/${encodeURIComponent(orderId)}/file`);
        if (!fileRes.ok) {
          res.status(fileRes.status).json({ ok: false, error: 'Không tìm thấy file in' });
          return;
        }
        const contentType = fileRes.headers.get('content-type') || 'image/png';
        const buffer = await fileRes.arrayBuffer();
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.status(200).end(Buffer.from(buffer));
      } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
      }
      return;
    }

    res.status(400).json({ ok: false, error: 'Yêu cầu không hợp lệ' });
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
}
