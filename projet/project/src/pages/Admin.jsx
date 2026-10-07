import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, syncLocalJson, uploadLocalImage } from '../lib/adminApi';

const FONT = "'HelveticaNeue', 'Helvetica', 'Arial', sans-serif";
const emptyVideo = {
  title: '',
  url: '',
  thumbnail: '',
  soustitre: '',
  description: '',
};
const emptyImage = {
  alt: '',
  url: '',
};
const FORM_FIELDS = [
  { key: 'title', label: 'Titre' },
  { key: 'url', label: 'URL Vimeo' },
  { key: 'soustitre', label: 'Sous-titre' },
  { key: 'description', label: 'Description' },
];

export default function Admin() {
  const [session, setSession] = useState('loading');
  const [password, setPassword] = useState('');
  const [videos, setVideos] = useState([]);
  const [images, setImages] = useState([]);
  const [tab, setTab] = useState('projects');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyVideo);
  const [editingImage, setEditingImage] = useState(null);
  const [creatingImage, setCreatingImage] = useState(false);
  const [imageForm, setImageForm] = useState(emptyImage);
  const [dragIndex, setDragIndex] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const galleryFileInputRef = useRef(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    html.classList.add('admin-mode');
    body.classList.add('admin-mode');
    root?.classList.add('admin-mode');
    return () => {
      html.classList.remove('admin-mode');
      body.classList.remove('admin-mode');
      root?.classList.remove('admin-mode');
    };
  }, []);

  const loadLists = useCallback(async () => {
    const [nextVideos, nextImages] = await Promise.all([adminApi.videos(), adminApi.images()]);
    setVideos(nextVideos);
    setImages(nextImages);
  }, []);

  useEffect(() => {
    adminApi
      .me()
      .then(async () => {
        await loadLists();
        setSession('in');
      })
      .catch(() => setSession('out'));
  }, [loadLists]);

  const applyPayload = (payload) => {
    if (Array.isArray(payload?.videos)) {
      syncLocalJson(payload.videos, payload.images);
    }
  };

  const afterMutation = async (payload, resetForm = true) => {
    applyPayload(payload);
    await loadLists();
    if (!resetForm) return;
    setCreating(false);
    setEditingVideo(null);
    setForm(emptyVideo);
    setCreatingImage(false);
    setEditingImage(null);
    setImageForm(emptyImage);
    setUploading(false);
  };

  const handleSaveImage = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = editingImage
        ? await adminApi.updateImage(editingImage.id, imageForm)
        : await adminApi.createImage(imageForm);
      await afterMutation(payload);
      setNotice(editingImage ? 'Image mise à jour.' : 'Image ajoutée.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteImage = async (item) => {
    if (!window.confirm(`Supprimer « ${item.alt} » ?`)) return;
    setBusy(true);
    try {
      const payload = await adminApi.deleteImage(item.id);
      await afterMutation(payload);
      setNotice('Image supprimée.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const moveImage = async (index, direction) => {
    const next = index + direction;
    if (next < 0 || next >= images.length) return;
    const ids = images.map((item) => item.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    setBusy(true);
    try {
      const payload = await adminApi.reorderImages(ids);
      await afterMutation(payload, false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await adminApi.login(password);
      await loadLists();
      setSession('in');
      setPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await adminApi.logout();
    setSession('out');
  };

  const handleSaveVideo = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = editingVideo
        ? await adminApi.updateVideo(editingVideo.id, form)
        : await adminApi.createVideo(form);
      await afterMutation(payload);
      setNotice(editingVideo ? 'Projet mis à jour.' : 'Projet créé.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteVideo = async (item) => {
    if (!window.confirm(`Supprimer « ${item.title} » ?`)) return;
    setBusy(true);
    try {
      const payload = await adminApi.deleteVideo(item.id);
      await afterMutation(payload);
      setNotice('Projet supprimé.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const moveItem = async (index, direction) => {
    const next = index + direction;
    if (next < 0 || next >= videos.length) return;
    const ids = videos.map((item) => item.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    setBusy(true);
    try {
      const payload = await adminApi.reorderVideos(ids);
      await afterMutation(payload, false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = async (dropIndex) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }
    const ids = videos.map((item) => item.id);
    const [moved] = ids.splice(dragIndex, 1);
    ids.splice(dropIndex, 0, moved);
    setDragIndex(null);
    setBusy(true);
    try {
      const payload = await adminApi.reorderVideos(ids);
      await afterMutation(payload, false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    setError('');
    setBusy(true);
    try {
      const payload = await adminApi.publish();
      applyPayload(payload);
      setNotice('Catalogue mis à jour.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startCreate = () => {
    setTab('projects');
    setCreating(true);
    setEditingVideo(null);
    setForm(emptyVideo);
    setCreatingImage(false);
    setEditingImage(null);
    setNotice('');
    setError('');
    setUploading(false);
  };

  const startCreateImage = () => {
    setTab('images');
    setCreatingImage(true);
    setEditingImage(null);
    setImageForm(emptyImage);
    setCreating(false);
    setEditingVideo(null);
    setNotice('');
    setError('');
    setUploading(false);
  };

  const handleImageUpload = async (file, kind = 'project') => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const publicPath = await uploadLocalImage(file);
      if (kind === 'gallery') {
        setImageForm((prev) => ({ ...prev, url: publicPath }));
      } else {
        setForm((prev) => ({ ...prev, thumbnail: publicPath }));
      }
      setNotice(`Image enregistrée : ${publicPath}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDropImage = async (dropIndex) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }
    const ids = images.map((item) => item.id);
    const [moved] = ids.splice(dragIndex, 1);
    ids.splice(dropIndex, 0, moved);
    setDragIndex(null);
    setBusy(true);
    try {
      const payload = await adminApi.reorderImages(ids);
      await afterMutation(payload, false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const showForm = creating || editingVideo;
  const showImageForm = creatingImage || editingImage;
  const imageValue = form.thumbnail || '';
  const galleryImageValue = imageForm.url || '';

  if (session === 'loading') {
    return (
      <div style={pageStyle}>
        <p style={{ fontFamily: FONT, color: '#494949' }}>Chargement…</p>
      </div>
    );
  }

  if (session === 'out') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>WIDE admin</h1>
          <p style={hintStyle}>Connexion réservée à l’administration du catalogue.</p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={labelStyle}>
              Mot de passe
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                autoFocus
              />
            </label>
            {error ? <p style={errorStyle}>{error}</p> : null}
            <button type="submit" disabled={busy} style={buttonStyle}>
              {busy ? 'Connexion…' : 'Entrer'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...pageStyle, alignItems: 'stretch' }}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ ...titleStyle, marginBottom: 4 }}>WIDE admin</h1>
          <p style={hintStyle}>
            Projets et images de galerie. Les fichiers uploadés sont stockés sur Cloudflare et le catalogue public lit D1, en local comme en production.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={handlePublish} disabled={busy} style={ghostButtonStyle}>
            Publier JSON
          </button>
          <button type="button" onClick={handleLogout} style={ghostButtonStyle}>
            Déconnexion
          </button>
        </div>
      </header>

      {error ? <p style={errorStyle}>{error}</p> : null}
      {notice ? <p style={noticeStyle}>{notice}</p> : null}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setTab('projects')}
          style={tab === 'projects' ? buttonStyle : ghostButtonStyle}
        >
          Projets
        </button>
        <button
          type="button"
          onClick={() => setTab('images')}
          style={tab === 'images' ? buttonStyle : ghostButtonStyle}
        >
          Images
        </button>
      </div>

      {tab === 'projects' ? (
        <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ ...hintStyle, margin: 0 }}>
          {videos.length} projet{videos.length > 1 ? 's' : ''} — glisser-déposer ou flèches pour classer.
        </p>
        <button type="button" onClick={startCreate} style={buttonStyle}>
          Nouveau projet
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleSaveVideo}
          style={{ ...cardStyle, width: '100%', maxWidth: 'none', marginBottom: 24 }}
        >
          <h2 style={sectionTitleStyle}>
            {editingVideo ? 'Modifier le projet' : 'Nouveau projet'}
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {FORM_FIELDS.map((field) => (
              <label key={field.key} style={labelStyle}>
                {field.label}
                <input
                  value={form[field.key] || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  style={inputStyle}
                  required={field.key === 'title' || field.key === 'url'}
                />
              </label>
            ))}
            <div style={labelStyle}>
              Miniature du projet
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
                disabled={busy || uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  handleImageUpload(file, 'project');
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                disabled={busy || uploading}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  textAlign: 'center',
                  opacity: busy || uploading ? 0.6 : 1,
                }}
              >
                {uploading ? 'Envoi en cours…' : 'Parcourir mon ordinateur'}
              </button>
              <span style={{ fontSize: 12, color: '#494949', fontWeight: 300 }}>
                Le fichier est envoyé sur Cloudflare et fonctionne en production.
              </span>
            </div>
            {imageValue ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={imageValue} alt="" style={{ ...thumbStyle, visibility: 'visible' }} />
                <p style={{ ...hintStyle, margin: 0 }}>{imageValue}</p>
              </div>
            ) : null}
            <label style={labelStyle}>
              Chemin (si l’image est déjà en ligne)
              <input
                value={imageValue}
                onChange={(e) => setForm((prev) => ({ ...prev, thumbnail: e.target.value }))}
                style={inputStyle}
                placeholder="/images/mon-projet.png"
                required={!imageValue}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="submit" disabled={busy || uploading} style={buttonStyle}>
              {uploading ? 'Upload…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setEditingVideo(null); }}
              style={ghostButtonStyle}
            >
              Annuler
            </button>
          </div>
        </form>
      ) : null}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 40 }}>
        {videos.map((item, index) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
            style={rowStyle}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
              <span style={orderStyle}>{index + 1}</span>
              <img
                src={item.thumbnail}
                alt=""
                style={thumbStyle}
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
              />
              <div style={{ minWidth: 0 }}>
                <p style={rowTitleStyle}>{item.title}</p>
                <p style={rowMetaStyle}>{item.soustitre || item.url}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button type="button" style={iconBtnStyle} disabled={busy || index === 0} onClick={() => moveItem(index, -1)}>↑</button>
              <button type="button" style={iconBtnStyle} disabled={busy || index === videos.length - 1} onClick={() => moveItem(index, 1)}>↓</button>
              <button
                type="button"
                style={iconBtnStyle}
                onClick={() => {
                  setEditingVideo(item);
                  setForm({ ...emptyVideo, ...item });
                  setCreating(false);
                }}
              >
                Modifier
              </button>
              <button type="button" style={{ ...iconBtnStyle, color: '#8a3a3a' }} onClick={() => handleDeleteVideo(item)}>
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ ...hintStyle, margin: 0 }}>
              {images.length} image{images.length > 1 ? 's' : ''} — glisser-déposer ou flèches pour classer.
            </p>
            <button type="button" onClick={startCreateImage} style={buttonStyle}>
              Nouvelle image
            </button>
          </div>

          {showImageForm ? (
            <form
              onSubmit={handleSaveImage}
              style={{ ...cardStyle, width: '100%', maxWidth: 'none', marginBottom: 24 }}
            >
              <h2 style={sectionTitleStyle}>
                {editingImage ? 'Modifier l’image' : 'Nouvelle image'}
              </h2>
              <div style={{ display: 'grid', gap: 12 }}>
                <label style={labelStyle}>
                  Texte alternatif
                  <input
                    value={imageForm.alt || ''}
                    onChange={(e) => setImageForm((prev) => ({ ...prev, alt: e.target.value }))}
                    style={inputStyle}
                    required
                  />
                </label>
                <div style={labelStyle}>
                  Fichier
                  <input
                    ref={galleryFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
                    disabled={busy || uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      handleImageUpload(file, 'gallery');
                      e.target.value = '';
                    }}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    disabled={busy || uploading}
                    onClick={() => galleryFileInputRef.current?.click()}
                    style={{
                      ...buttonStyle,
                      width: '100%',
                      textAlign: 'center',
                      opacity: busy || uploading ? 0.6 : 1,
                    }}
                  >
                    {uploading ? 'Envoi en cours…' : 'Parcourir mon ordinateur'}
                  </button>
                </div>
                {galleryImageValue ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={galleryImageValue} alt="" style={{ ...thumbStyle, visibility: 'visible' }} />
                    <p style={{ ...hintStyle, margin: 0 }}>{galleryImageValue}</p>
                  </div>
                ) : null}
                <label style={labelStyle}>
                  Chemin
                  <input
                    value={galleryImageValue}
                    onChange={(e) => setImageForm((prev) => ({ ...prev, url: e.target.value }))}
                    style={inputStyle}
                    placeholder="/images/ma-photo.png"
                    required
                  />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button type="submit" disabled={busy || uploading} style={buttonStyle}>
                  {uploading ? 'Upload…' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={() => { setCreatingImage(false); setEditingImage(null); }}
                  style={ghostButtonStyle}
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : null}

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 40 }}>
            {images.map((item, index) => (
              <li
                key={item.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropImage(index)}
                style={rowStyle}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                  <span style={orderStyle}>{index + 1}</span>
                  <img
                    src={item.url}
                    alt=""
                    style={thumbStyle}
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <p style={rowTitleStyle}>{item.alt}</p>
                    <p style={rowMetaStyle}>{item.url}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button type="button" style={iconBtnStyle} disabled={busy || index === 0} onClick={() => moveImage(index, -1)}>↑</button>
                  <button type="button" style={iconBtnStyle} disabled={busy || index === images.length - 1} onClick={() => moveImage(index, 1)}>↓</button>
                  <button
                    type="button"
                    style={iconBtnStyle}
                    onClick={() => {
                      setEditingImage(item);
                      setImageForm({ ...emptyImage, ...item });
                      setCreatingImage(false);
                    }}
                  >
                    Modifier
                  </button>
                  <button type="button" style={{ ...iconBtnStyle, color: '#8a3a3a' }} onClick={() => handleDeleteImage(item)}>
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const pageStyle = {
  minHeight: '100vh',
  backgroundColor: '#F6F6F6',
  color: '#272727',
  fontFamily: FONT,
  padding: '32px 28px 64px',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
};

const headerStyle = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  marginBottom: 28,
};

const cardStyle = {
  width: '100%',
  maxWidth: 420,
  background: '#fff',
  border: '1px solid #e6e6e6',
  padding: 28,
  boxSizing: 'border-box',
};

const titleStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 32,
  margin: 0,
};

const sectionTitleStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 20,
  margin: '0 0 16px',
};

const hintStyle = {
  color: '#494949',
  fontSize: 14,
  fontWeight: 300,
  margin: '0 0 20px',
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  color: '#494949',
};

const inputStyle = {
  fontFamily: FONT,
  fontSize: 15,
  padding: '10px 12px',
  border: '1px solid #d1d1d1',
  background: '#F6F6F6',
  color: '#272727',
  outline: 'none',
};

const buttonStyle = {
  fontFamily: FONT,
  fontSize: 14,
  padding: '10px 16px',
  border: 'none',
  background: '#272727',
  color: '#F6F6F6',
  cursor: 'pointer',
};

const ghostButtonStyle = {
  ...buttonStyle,
  background: 'transparent',
  color: '#272727',
  border: '1px solid #272727',
};

const errorStyle = { color: '#8a3a3a', fontSize: 14, margin: '0 0 12px' };
const noticeStyle = { color: '#2f5d3a', fontSize: 14, margin: '0 0 12px' };

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  background: '#fff',
  border: '1px solid #e6e6e6',
  padding: '12px 14px',
  cursor: 'grab',
};

const orderStyle = {
  width: 24,
  textAlign: 'center',
  color: '#494949',
  fontSize: 13,
  flexShrink: 0,
};

const thumbStyle = {
  width: 42,
  height: 74,
  objectFit: 'cover',
  background: '#eee',
  flexShrink: 0,
};

const rowTitleStyle = {
  margin: 0,
  fontSize: 15,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const rowMetaStyle = {
  margin: '4px 0 0',
  fontSize: 12,
  color: '#494949',
  fontWeight: 300,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const iconBtnStyle = {
  fontFamily: FONT,
  fontSize: 12,
  padding: '6px 8px',
  border: '1px solid #d1d1d1',
  background: '#F6F6F6',
  cursor: 'pointer',
  color: '#272727',
};
