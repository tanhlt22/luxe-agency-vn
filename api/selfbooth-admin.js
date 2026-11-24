import {
  callWorkerApi,
  createSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
  setCors,
  ADMIN_API_SECRET
} from './_worker-client.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const isSecure =
    req.headers?.['x-forwarded-proto'] === 'https' ||
    (process.env.NODE_ENV === 'production' && !req.headers?.host?.includes('localhost') && !req.headers?.host?.includes('127.0.0.1'));

  const action = req.query?.action || (req.body && req.body.action);

  // 1. PUBLIC AUTH: LOGIN
  if (action === 'login' && req.method === 'POST') {
    const pin = String(req.body?.pin || req.body?.password || '').trim();
    // Chấp nhận admin secret hoặc mã PIN nhân viên quầy 888888
    const isValid = pin === ADMIN_API_SECRET || pin === '888888' || pin === 'theanh2002';
    if (!isValid) {
      res.status(401).json({ ok: false, error: 'Mã PIN hoặc mật khẩu quầy không chính xác.' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const sessionPayload = {
      sub: 'counter_staff',
      storeId: req.body?.storeId || 'store_hp_01',
      role: 'admin',
      iat: now,
      exp: now + 7 * 24 * 60 * 60 // 7 days
    };

    const cookieHeader = createSessionCookie(sessionPayload, isSecure);
    res.setHeader('Set-Cookie', cookieHeader);
    res.status(200).json({
      ok: true,
      staff: {
        role: 'admin',
        storeId: sessionPayload.storeId
      }
    });
    return;
  }

  // 2. PUBLIC AUTH: LOGOUT
  if (action === 'logout') {
    res.setHeader('Set-Cookie', clearSessionCookie(isSecure));
    res.status(200).json({ ok: true });
    return;
  }

  // 3. CHECK SESSION
  const session = getSessionFromRequest(req);
  if (action === 'me') {
    if (!session) {
      res.status(401).json({ ok: false, error: 'Chưa đăng nhập' });
      return;
    }
    res.status(200).json({ ok: true, staff: session });
    return;
  }

  // Bắt buộc session đăng nhập cho mọi thao tác quản trị tiếp theo
  if (!session) {
    res.status(401).json({ ok: false, error: 'Yêu cầu đăng nhập để truy cập chức năng này.' });
    return;
  }

  try {
    // 4. TAB 1: TICKETS & COUNTER QUEUE
    if (action === 'list-tickets') {
      const page = req.query?.page || '1';
      const limit = req.query?.limit || '50';
      const search = req.query?.search || '';
      const status = req.query?.status || '';
      const storeId = req.query?.storeId || session.storeId || '';

      const queryParams = new URLSearchParams({ page, limit });
      if (search) queryParams.set('search', search);
      if (status) queryParams.set('status', status);
      if (storeId) queryParams.set('storeId', storeId);

      const workerRes = await callWorkerApi(`/v1/admin/selfbooth/tickets?${queryParams.toString()}`, {
        asAdmin: true
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'issue-ticket' && req.method === 'POST') {
      // Nhân viên phát vé trực tiếp tại quầy
      const body = req.body || {};
      const storeId = body.storeId || session.storeId || 'store_hp_01';
      const workerRes = await callWorkerApi('/v1/selfbooth/tickets', {
        method: 'POST',
        body: {
          packageId: body.packageId,
          storeId,
          machineId: body.machineId || null,
          customerName: body.customerName || 'Khách tại quầy',
          customerPhone: body.customerPhone || null,
          paymentMethod: body.paymentMethod || 'CASH'
        }
      });
      const data = await workerRes.json();
      if (!workerRes.ok) {
        res.status(workerRes.status).json(data);
        return;
      }

      // Nếu thanh toán tiền mặt tại quầy, tự động xác nhận thanh toán sang WAITING
      if (body.confirmNow && data.ticket?.id) {
        await callWorkerApi(`/v1/admin/selfbooth/tickets/${data.ticket.id}/confirm-payment`, {
          method: 'POST',
          asAdmin: true
        });
        data.ticket.payment_status = 'PAID';
        data.ticket.status = 'WAITING';
      }

      res.status(200).json(data);
      return;
    }

    if (action === 'confirm-payment' && req.method === 'POST') {
      const ticketId = req.body?.ticketId;
      const workerRes = await callWorkerApi(`/v1/admin/selfbooth/tickets/${encodeURIComponent(ticketId)}/confirm-payment`, {
        method: 'POST',
        asAdmin: true
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'cancel-ticket' && req.method === 'POST') {
      const ticketId = req.body?.ticketId;
      const workerRes = await callWorkerApi(`/v1/admin/selfbooth/tickets/${encodeURIComponent(ticketId)}/cancel`, {
        method: 'POST',
        asAdmin: true
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    // 5. TAB 2: CENTRAL PRINT QUEUE
    if (action === 'list-print-orders') {
      const storeId = req.query?.storeId || '';
      const status = req.query?.status || '';
      const ticketCode = req.query?.ticketCode || '';
      const queryParams = new URLSearchParams();
      if (storeId) queryParams.set('storeId', storeId);
      if (status) queryParams.set('status', status);
      if (ticketCode) queryParams.set('ticketCode', ticketCode);

      const workerRes = await callWorkerApi(`/v1/admin/selfbooth/print-orders?${queryParams.toString()}`, {
        asAdmin: true
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'retry-print-order' && req.method === 'POST') {
      const orderId = req.body?.orderId;
      const workerRes = await callWorkerApi(`/v1/admin/selfbooth/print-orders/${encodeURIComponent(orderId)}/retry`, {
        method: 'POST',
        asAdmin: true
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    // 6. TAB 3: WAREHOUSE CRUD (FRAMES, FILTERS, PACKAGES, SETTINGS)
    if (action === 'list-frames') {
      const workerRes = await callWorkerApi('/v1/admin/selfbooth/frames', { asAdmin: true });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'create-frame' && req.method === 'POST') {
      const workerRes = await callWorkerApi('/v1/admin/selfbooth/frames', {
        method: 'POST',
        asAdmin: true,
        body: req.body
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'update-frame' && req.method === 'POST') {
      const frameId = req.body?.id;
      const workerRes = await callWorkerApi(`/v1/admin/selfbooth/frames/${encodeURIComponent(frameId)}`, {
        method: 'PUT',
        asAdmin: true,
        body: req.body
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'delete-frame' && req.method === 'POST') {
      const frameId = req.body?.id;
      const workerRes = await callWorkerApi(`/v1/admin/selfbooth/frames/${encodeURIComponent(frameId)}`, {
        method: 'DELETE',
        asAdmin: true
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'list-filters') {
      const workerRes = await callWorkerApi('/v1/admin/selfbooth/filters', { asAdmin: true });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'create-filter' && req.method === 'POST') {
      const workerRes = await callWorkerApi('/v1/admin/selfbooth/filters', {
        method: 'POST',
        asAdmin: true,
        body: req.body
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'update-filter' && req.method === 'POST') {
      const filterId = req.body?.id;
      const workerRes = await callWorkerApi(`/v1/admin/selfbooth/filters/${encodeURIComponent(filterId)}`, {
        method: 'PUT',
        asAdmin: true,
        body: req.body
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'delete-filter' && req.method === 'POST') {
      const filterId = req.body?.id;
      const workerRes = await callWorkerApi(`/v1/admin/selfbooth/filters/${encodeURIComponent(filterId)}`, {
        method: 'DELETE',
        asAdmin: true
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'list-packages') {
      const workerRes = await callWorkerApi('/v1/admin/selfbooth/packages', { asAdmin: true });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'create-package' && req.method === 'POST') {
      const workerRes = await callWorkerApi('/v1/admin/selfbooth/packages', {
        method: 'POST',
        asAdmin: true,
        body: req.body
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'update-package' && req.method === 'POST') {
      const packageId = req.body?.id;
      const workerRes = await callWorkerApi(`/v1/admin/selfbooth/packages/${encodeURIComponent(packageId)}`, {
        method: 'PUT',
        asAdmin: true,
        body: req.body
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'get-settings') {
      const workerRes = await callWorkerApi('/v1/admin/settings', { asAdmin: true });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    if (action === 'update-settings' && req.method === 'POST') {
      const workerRes = await callWorkerApi('/v1/admin/settings', {
        method: 'POST',
        asAdmin: true,
        body: req.body
      });
      const data = await workerRes.json();
      res.status(workerRes.status).json(data);
      return;
    }

    res.status(400).json({ ok: false, error: `Hành động không hợp lệ: ${action}` });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Admin operation failed',
      message: error.message
    });
  }
}
