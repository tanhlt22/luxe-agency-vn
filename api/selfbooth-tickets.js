import { callWorkerApi, setCors } from './_worker-client.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // POST: Khách đặt vé mới
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const workerRes = await callWorkerApi('/v1/selfbooth/tickets', {
        method: 'POST',
        body
      });

      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: 'Ticket creation failed',
        message: error.message
      });
    }
    return;
  }

  // GET: Tra cứu vé & hàng đợi theo mã 6 số hoặc reference_code
  if (req.method === 'GET') {
    const code = req.query?.code || req.query?.ticketCode || req.query?.id;
    if (!code) {
      res.status(400).json({
        ok: false,
        error: 'Missing ticket code'
      });
      return;
    }

    try {
      const workerRes = await callWorkerApi(`/v1/selfbooth/tickets/${encodeURIComponent(code)}`);
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: 'Ticket lookup failed',
        message: error.message
      });
    }
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
}
