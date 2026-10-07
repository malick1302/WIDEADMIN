import {
  clearSessionCookie,
  createSessionToken,
  requireAdmin,
  setSessionCookie,
} from './auth.js';
import {
  createImage,
  createProject,
  deleteImage,
  deleteProject,
  exportPublicPayload,
  listImages,
  listProjects,
  reorder,
  updateImage,
  updateProject,
} from './db.js';

const ALLOWED_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function extOf(filename) {
  const dot = String(filename || '').lastIndexOf('.');
  return dot >= 0 ? String(filename).slice(dot).toLowerCase() : '';
}

function safeFilename(filename) {
  const ext = extOf(filename) || '.png';
  const base = String(filename || 'image')
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';
  return `${Date.now()}-${base}${ext}`;
}

async function handleUpload(request, env) {
  if (!env.UPLOADS) {
    throw new Error('Stockage images non configuré.');
  }
  const body = await readBody(request);
  if (!body.filename || !body.data) {
    throw new Error('Fichier manquant.');
  }
  const ext = extOf(body.filename);
  const contentType = ALLOWED_MIME[ext];
  if (!contentType) {
    throw new Error('Format non supporté. Utilise png, jpg, webp ou gif.');
  }
  const buffer = Uint8Array.from(atob(body.data), (c) => c.charCodeAt(0));
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('Fichier trop lourd (max 8 Mo).');
  }
  const key = safeFilename(body.filename);
  await env.UPLOADS.put(key, buffer, { metadata: { contentType } });
  return json({ path: `/uploads/${key}` }, 201);
}

async function serveUpload(env, pathname) {
  if (!env.UPLOADS) return new Response('Not found', { status: 404 });
  const key = decodeURIComponent(pathname.replace(/^\/uploads\//, ''));
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });
  const result = await env.UPLOADS.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!result?.value) return new Response('Not found', { status: 404 });
  return new Response(result.value, {
    headers: {
      'Content-Type': result.metadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

function matchPath(pathname) {
  const videoItem = pathname.match(/^\/api\/admin\/videos\/(\d+)$/);
  if (videoItem) return { kind: 'video', id: Number(videoItem[1]) };
  const imageItem = pathname.match(/^\/api\/admin\/images\/(\d+)$/);
  if (imageItem) return { kind: 'image', id: Number(imageItem[1]) };
  return { kind: pathname, id: null };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/uploads/')) {
      return serveUpload(env, url.pathname);
    }

    if (url.pathname === '/api/videos' && request.method === 'GET') {
      return json(await listProjects(env.DB));
    }

    if (url.pathname === '/api/images' && request.method === 'GET') {
      return json(await listImages(env.DB));
    }

    if (!url.pathname.startsWith('/api/admin')) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('Not found', { status: 404 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    try {
      return await handleAdmin(request, env, url);
    } catch (err) {
      if (err instanceof Response) return err;
      console.error(err);
      return json({ error: err.message || 'Erreur serveur.' }, 500);
    }
  },
};

async function handleAdmin(request, env, url) {
  const { pathname } = url;
  const method = request.method.toUpperCase();

  if (pathname === '/api/admin/login' && method === 'POST') {
    const body = await readBody(request);
    if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
      return json({ error: 'Admin non configuré.' }, 500);
    }
    if (!body.password || body.password !== env.ADMIN_PASSWORD) {
      return json({ error: 'Mot de passe incorrect.' }, 401);
    }
    const token = await createSessionToken(env.ADMIN_SECRET);
    return json({ ok: true }, 200, { 'Set-Cookie': setSessionCookie(token) });
  }

  if (pathname === '/api/admin/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
  }

  await requireAdmin(request, env);

  if (pathname === '/api/admin/me' && method === 'GET') {
    return json({ ok: true });
  }

  if (pathname === '/api/admin/publish' && (method === 'POST' || method === 'GET')) {
    const payload = await exportPublicPayload(env.DB);
    return json(payload);
  }

  if (pathname === '/api/admin/upload' && method === 'POST') {
    return handleUpload(request, env);
  }

  if (pathname === '/api/admin/videos' && method === 'GET') {
    return json(await listProjects(env.DB));
  }

  if (pathname === '/api/admin/videos' && method === 'POST') {
    const created = await createProject(env.DB, await readBody(request));
    const payload = await exportPublicPayload(env.DB);
    return json({ item: created, ...payload }, 201);
  }

  if (pathname === '/api/admin/videos/reorder' && method === 'PUT') {
    const body = await readBody(request);
    await reorder(env.DB, 'projects', body.ids);
    const payload = await exportPublicPayload(env.DB);
    return json(payload);
  }

  if (pathname === '/api/admin/images' && method === 'GET') {
    return json(await listImages(env.DB));
  }

  if (pathname === '/api/admin/images' && method === 'POST') {
    const created = await createImage(env.DB, await readBody(request));
    const payload = await exportPublicPayload(env.DB);
    return json({ item: created, ...payload }, 201);
  }

  if (pathname === '/api/admin/images/reorder' && method === 'PUT') {
    const body = await readBody(request);
    await reorder(env.DB, 'gallery_images', body.ids);
    const payload = await exportPublicPayload(env.DB);
    return json(payload);
  }

  const matched = matchPath(pathname);

  if (matched.kind === 'video') {
    if (method === 'PUT') {
      const updated = await updateProject(env.DB, matched.id, await readBody(request));
      if (!updated) return json({ error: 'Projet introuvable.' }, 404);
      const payload = await exportPublicPayload(env.DB);
      return json({ item: updated, ...payload });
    }
    if (method === 'DELETE') {
      const ok = await deleteProject(env.DB, matched.id);
      if (!ok) return json({ error: 'Projet introuvable.' }, 404);
      const payload = await exportPublicPayload(env.DB);
      return json(payload);
    }
  }

  if (matched.kind === 'image') {
    if (method === 'PUT') {
      const updated = await updateImage(env.DB, matched.id, await readBody(request));
      if (!updated) return json({ error: 'Image introuvable.' }, 404);
      const payload = await exportPublicPayload(env.DB);
      return json({ item: updated, ...payload });
    }
    if (method === 'DELETE') {
      const ok = await deleteImage(env.DB, matched.id);
      if (!ok) return json({ error: 'Image introuvable.' }, 404);
      const payload = await exportPublicPayload(env.DB);
      return json(payload);
    }
  }

  return json({ error: 'Route introuvable.' }, 404);
}
