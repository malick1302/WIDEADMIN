const jsonHeaders = { 'Content-Type': 'application/json' };

async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      ...jsonHeaders,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Erreur API');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const adminApi = {
  me: () => request('/api/admin/me'),
  login: (password) =>
    request('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request('/api/admin/logout', { method: 'POST' }),
  videos: () => request('/api/admin/videos'),
  images: () => request('/api/admin/images'),
  createVideo: (body) =>
    request('/api/admin/videos', { method: 'POST', body: JSON.stringify(body) }),
  updateVideo: (id, body) =>
    request(`/api/admin/videos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteVideo: (id) => request(`/api/admin/videos/${id}`, { method: 'DELETE' }),
  reorderVideos: (ids) =>
    request('/api/admin/videos/reorder', { method: 'PUT', body: JSON.stringify({ ids }) }),
  createImage: (body) =>
    request('/api/admin/images', { method: 'POST', body: JSON.stringify(body) }),
  updateImage: (id, body) =>
    request(`/api/admin/images/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteImage: (id) => request(`/api/admin/images/${id}`, { method: 'DELETE' }),
  reorderImages: (ids) =>
    request('/api/admin/images/reorder', { method: 'PUT', body: JSON.stringify({ ids }) }),
  publish: () => request('/api/admin/publish', { method: 'POST' }),
};

export function syncLocalJson(videos, images) {
  if (import.meta.hot) {
    import.meta.hot.send('admin:sync-json', { videos, images });
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadLocalImage(file) {
  const data = await fileToBase64(file);
  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify({ filename: file.name, data }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.path) {
    throw new Error(payload.error || 'Impossible d’enregistrer l’image.');
  }
  if (import.meta.env.DEV) {
    fetch('/__dev/upload-image', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ filename: file.name, data }),
    }).catch(() => {});
  }
  return payload.path;
}
