'use client';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useTheme } from '@/context';
import '@/styles/components/ErdDiagram.css';

function inferMermaidType(colName, sampleValue) {
  const lower = colName.toLowerCase();
  const strVal = sampleValue !== null && sampleValue !== undefined ? String(sampleValue) : '';

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(strVal)) return 'string';

  const dateCols = ['created_at', 'updated_at', 'deleted_at', 'timestamp', 'date', 'time', 'datetime'];
  if (dateCols.some(d => lower.includes(d))) return 'datetime';

  if (strVal === 'true' || strVal === 'false') return 'boolean';
  if (/^-?\d+$/.test(strVal) && strVal.length < 15) return 'int';
  if (/^-?\d+\.\d+$/.test(strVal)) return 'float';

  return 'string';
}

function sanitise(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

// Frontend inference fallback for missing relationships
function inferMissingRelationships(tables, existingRelationships = []) {
  const inferred = [...(existingRelationships || [])];
  if (!tables?.length) return inferred;

  // Create a map of lowercased table names to their actual names for easy lookup
  const tableMap = new Map(tables.map(t => [t.tableName.toLowerCase(), t.tableName]));
  const tableNames = Array.from(tableMap.keys());

  tables.forEach(table => {
    const columns = table.rows?.length ? Object.keys(table.rows[0]) : [];

    columns.forEach(col => {
      const lowerCol = col.toLowerCase();

      // Look for FK naming conventions: "tableNameId" or "table_name_id"
      if (lowerCol.endsWith('id') && lowerCol !== 'id') {
        // Strip the "id" or "_id" suffix to find the base name
        const baseNameNoUnderscore = lowerCol.replace(/_?id$/, '');

        // 1. Attempt exact match
        let targetTable = tableMap.get(baseNameNoUnderscore);

        // 2. Attempt fuzzy match (plurals or prefix abbreviations)
        if (!targetTable) {
          const fuzzyMatch = tableNames.find(t =>
            t === `${baseNameNoUnderscore}s` ||       // e.g., user -> users
            t === `${baseNameNoUnderscore}es` ||      // e.g., branch -> branches
            t.startsWith(baseNameNoUnderscore)        // e.g., org -> organizations
          );
          if (fuzzyMatch) {
            targetTable = tableMap.get(fuzzyMatch);
          }
        }

        if (targetTable) {
          // Check if this relationship is already mapped to prevent duplicate rendering
          const alreadyExists = inferred.some(
            rel => rel.fromTable === table.tableName && rel.fromCol === col
          );

          if (!alreadyExists) {
            inferred.push({
              fromTable: table.tableName,
              fromCol: col,
              toTable: targetTable,
              toCol: 'id'
            });
          }
        }
      }
    });
  });

  return inferred;
}

function buildMermaidERD(tables, relationships) {
  if (!tables?.length) return '';

  let erd = 'erDiagram\n';

  relationships.forEach(rel => {
    const from = sanitise(rel.fromTable);
    const to = sanitise(rel.toTable);
    const col = sanitise(rel.fromCol);
    erd += `    ${to} ||--o{ ${from} : "${col}"\n`;
  });

  tables.forEach(table => {
    const columns = table.rows?.length ? Object.keys(table.rows[0]) : [];
    const sampleRow = table.rows?.[0] ?? {};
    const entity = sanitise(table.tableName);

    erd += `    ${entity} {\n`;
    columns.forEach(col => {
      const type = inferMermaidType(col, sampleRow[col]);
      const lower = col.toLowerCase();

      const isExplicitFK = relationships.some(rel => rel.fromTable === table.tableName && rel.fromCol === col);

      const isPK = lower === 'id' || (lower.endsWith('id') && !lower.includes('_') && !isExplicitFK);
      const isFK = isExplicitFK || (lower.endsWith('_id') && lower !== 'id');

      const modifier = isPK ? ' PK' : isFK ? ' FK' : '';
      erd += `        ${type} ${sanitise(col)}${modifier}\n`;
    });
    erd += `    }\n`;
  });

  return erd;
}

function getMermaidThemeVars(isDark) {
  if (isDark) {
    return {
      background: 'transparent',
      primaryColor: '#1e293b',
      primaryTextColor: '#e2e8f0',
      primaryBorderColor: '#334155',
      lineColor: '#38bdf8',
      secondaryColor: '#0f172a',
      tertiaryColor: '#1a2744',
      mainBkg: '#1e293b',
      nodeBorder: '#334155',
      attributeBackgroundColorEven: '#1e293b',
      attributeBackgroundColorOdd: '#162032',
      titleColor: '#e2e8f0',
      edgeLabelBackground: '#1e293b',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '20px',
    };
  }
  return {
    background: 'transparent',
    primaryColor: '#f8fafc',
    primaryTextColor: '#1e293b',
    primaryBorderColor: '#cbd5e1',
    lineColor: '#0ea5e9',
    secondaryColor: '#f1f5f9',
    tertiaryColor: '#e2e8f0',
    mainBkg: '#ffffff',
    nodeBorder: '#cbd5e1',
    attributeBackgroundColorEven: '#f8fafc',
    attributeBackgroundColorOdd: '#f1f5f9',
    titleColor: '#1e293b',
    edgeLabelBackground: '#ffffff',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '20px',
  };
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.12;

export function ErdDiagram({ tables, relationships = [] }) {
  const { currentTheme } = useTheme();
  const isDark = ['recode-dark', 'midnight-gold', 'deep-sea'].includes(currentTheme);

  const svgHostRef = useRef(null);
  const viewportRef = useRef(null);

  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  const effectiveRelationships = useMemo(
    () => inferMissingRelationships(tables, relationships),
    [tables, relationships]
  );

  const diagram = useMemo(
    () => buildMermaidERD(tables, effectiveRelationships),
    [tables, effectiveRelationships],
  );

  const resetView = useCallback(() => setTransform({ x: 0, y: 0, scale: 1 }), []);

  useEffect(() => {
    if (!diagram || !svgHostRef.current) return;

    let cancelled = false;
    setIsRendering(true);
    setRenderError(null);

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          themeVariables: getMermaidThemeVars(isDark),
          er: {
            diagramPadding: 24,
            layoutDirection: 'TB',
            minEntityWidth: 120,
            minEntityHeight: 80,
            entityPadding: 16,
            useMaxWidth: false,
          },
          securityLevel: 'loose',
        });

        if (cancelled) return;

        const renderId = `erd-mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(renderId, diagram);

        if (cancelled || !svgHostRef.current) return;

        svgHostRef.current.innerHTML = svg;

        const svgEl = svgHostRef.current.querySelector('svg');
        if (svgEl) {
          svgEl.style.display = 'block';
        }

        resetView();
      } catch (err) {
        if (!cancelled) {
          console.error('[ErdDiagram] Mermaid render error:', err);
          setRenderError(err?.message ?? 'Failed to render ERD diagram.');
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    })();

    return () => { cancelled = true; };
  }, [diagram, isDark, resetView]);

  const clampScale = (s) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s));

  const zoomAt = useCallback((cx, cy, delta) => {
    setTransform(prev => {
      const newScale = clampScale(prev.scale + delta);
      const ratio = newScale / prev.scale;
      const newX = cx - ratio * (cx - prev.x);
      const newY = cy - ratio * (cy - prev.y);
      return { x: newX, y: newY, scale: newScale };
    });
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      zoomAt(cx, cy, delta);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const transformRef = useRef(transform);
  useEffect(() => { transformRef.current = transform; }, [transform]);

  const onPointerDown = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = transformRef.current;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: x,
      originY: y,
    };
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setTransform(prev => ({
      ...prev,
      x: dragRef.current.originX + dx,
      y: dragRef.current.originY + dy,
    }));
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const zoomIn = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    zoomAt(width / 2, height / 2, ZOOM_STEP);
  }, [zoomAt]);

  const zoomOut = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    zoomAt(width / 2, height / 2, -ZOOM_STEP);
  }, [zoomAt]);

  if (!tables?.length) return null;

  const isDragging = dragRef.current.active;

  return (
    <div className="erd-mermaid-wrapper">

      {!isRendering && !renderError && (
        <div className="erd-toolbar">
          <button className="erd-tool-btn" onClick={zoomIn} title="Zoom in">
            <i className="fas fa-search-plus" />
          </button>
          <span className="erd-zoom-label">{Math.round(transform.scale * 100)}%</span>
          <button className="erd-tool-btn" onClick={zoomOut} title="Zoom out">
            <i className="fas fa-search-minus" />
          </button>
          <div className="erd-toolbar-divider" />
          <button className="erd-tool-btn" onClick={resetView} title="Reset view">
            <i className="fas fa-compress-arrows-alt" />
          </button>
          <span className="erd-toolbar-hint">
            <i className="fas fa-hand-paper" /> Drag to pan · Scroll to zoom
          </span>
        </div>
      )}

      {isRendering && (
        <div className="erd-overlay erd-loading">
          <i className="fas fa-circle-notch fa-spin" />
          <span>Rendering diagram…</span>
        </div>
      )}

      {renderError && !isRendering && (
        <div className="erd-overlay erd-error">
          <i className="fas fa-exclamation-triangle" />
          <span>Render error: {renderError}</span>
        </div>
      )}

      <div
        ref={viewportRef}
        className={`erd-viewport${isDragging ? ' erd-viewport--dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div
          className="erd-canvas-layer"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
          }}
        >
          <div ref={svgHostRef} className="erd-svg-host" />
        </div>
      </div>

      {!isRendering && !renderError && effectiveRelationships.length > 0 && (
        <div className="erd-legend">
          <span className="erd-legend-item">
            <span className="erd-legend-line" />
            FK Relationship
          </span>
          <span className="erd-legend-item">PK — Primary Key</span>
          <span className="erd-legend-item">FK — Foreign Key</span>
        </div>
      )}

      {!isRendering && effectiveRelationships.length === 0 && (
        <div className="erd-no-relations">
          No FK relationships detected between tables
        </div>
      )}
    </div>
  );
}