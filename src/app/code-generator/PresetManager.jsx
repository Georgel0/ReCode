'use client';

import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'cg-presets';

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistPresets(presets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.warn('Could not save presets:', e);
  }
}

export default function PresetManager({ config, onApply }) {
  const [presets, setPresets] = useState([]);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [saved, setSaved] = useState(false);

  const dropdownRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setEditingId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const sync = (updated) => {
    setPresets(updated);
    persistPresets(updated);
  };

  const handleSave = () => {
    const name = newName.trim();
    if (!name) return;
    const preset = {
      id: genId(),
      name,
      config: { ...config },
      isFavorite: false,
      createdAt: Date.now(),
    };
    sync([...presets, preset]);
    setNewName('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    sync(presets.filter(p => p.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleFavorite = (id, e) => {
    e.stopPropagation();
    sync(presets.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p));
  };

  const startRename = (preset, e) => {
    e.stopPropagation();
    setEditingId(preset.id);
    setEditingName(preset.name);
  };

  const commitRename = (id) => {
    const name = editingName.trim();
    if (name) sync(presets.map(p => p.id === id ? { ...p, name } : p));
    setEditingId(null);
  };

  const handleApply = (preset) => {
    onApply(preset.config);
    setOpen(false);
  };

  const sorted = [...presets].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return b.isFavorite - a.isFavorite;
    return b.createdAt - a.createdAt;
  });

  const hasFavs = sorted.some(p => p.isFavorite);
  const hasNonFavs = sorted.some(p => !p.isFavorite);

  return (
    <div className="g-preset-manager" ref={dropdownRef}>
      <button
        className="g-preset-trigger"
        onClick={() => setOpen(v => !v)}
        title="Manage configuration presets"
      >
        <i className="fa-solid fa-bookmark"></i>
        <span>Presets</span>
        {presets.length > 0 && (
          <span className="g-preset-count">{presets.length}</span>
        )}
        <i className={`fa-solid fa-chevron-down g-preset-chevron${open ? ' open' : ''}`}></i>
      </button>

      {open && (
        <div className="g-preset-dropdown">
          <div className="g-preset-list-wrap">
            {sorted.length === 0 ? (
              <p className="g-preset-empty">
                <i className="fa-regular fa-bookmark"></i>
                No saved presets yet
              </p>
            ) : (
              <ul className="g-preset-list">
                {hasFavs && (
                  <li className="g-preset-section-label">
                    <i className="fa-solid fa-star"></i> Favorites
                  </li>
                )}
                {sorted.filter(p => p.isFavorite).map(preset => (
                  <PresetRow
                    key={preset.id}
                    preset={preset}
                    editingId={editingId}
                    editingName={editingName}
                    setEditingName={setEditingName}
                    onApply={handleApply}
                    onFavorite={handleFavorite}
                    onRename={startRename}
                    onCommit={commitRename}
                    onCancel={() => setEditingId(null)}
                    onDelete={handleDelete}
                  />
                ))}

                {hasFavs && hasNonFavs && (
                  <li className="g-preset-section-label">
                    <i className="fa-regular fa-clock"></i> All presets
                  </li>
                )}
                {sorted.filter(p => !p.isFavorite).map(preset => (
                  <PresetRow
                    key={preset.id}
                    preset={preset}
                    editingId={editingId}
                    editingName={editingName}
                    setEditingName={setEditingName}
                    onApply={handleApply}
                    onFavorite={handleFavorite}
                    onRename={startRename}
                    onCommit={commitRename}
                    onCancel={() => setEditingId(null)}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="g-preset-save-row">
            <input
              ref={nameInputRef}
              className="g-preset-name-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name this preset..."
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button
              className={`g-preset-save-btn${saved ? ' saved' : ''}`}
              onClick={handleSave}
              disabled={!saved && !newName.trim()}
              title="Save current config as a preset"
            >
              <i className={`fa-solid ${saved ? 'fa-check' : 'fa-floppy-disk'}`}></i>
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PresetRow({
  preset, editingId, editingName, setEditingName,
  onApply, onFavorite, onRename, onCommit, onCancel, onDelete,
}) {
  const isEditing = editingId === preset.id;

  return (
    <li className="g-preset-item">
      <button
        className={`g-preset-star${preset.isFavorite ? ' active' : ''}`}
        onClick={(e) => onFavorite(preset.id, e)}
        title={preset.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <i className={preset.isFavorite ? 'fa-solid fa-star' : 'fa-regular fa-star'}></i>
      </button>

      {isEditing ? (
        <input
          className="g-preset-rename-input"
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onBlur={() => onCommit(preset.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit(preset.id);
            if (e.key === 'Escape') onCancel();
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <button
          className="g-preset-name-btn"
          onClick={() => onApply(preset)}
          title={`Apply "${preset.name}"`}
        >
          {preset.name}
        </button>
      )}

      <div className="g-preset-row-actions">
        <button
          className="g-preset-icon-btn"
          onClick={(e) => onRename(preset, e)}
          title="Rename"
        >
          <i className="fa-solid fa-pencil"></i>
        </button>
        <button
          className="g-preset-icon-btn danger"
          onClick={(e) => onDelete(preset.id, e)}
          title="Delete"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
    </li>
  );
}