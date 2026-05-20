'use client';
import { useRef, useEffect } from "react";

export function ErdDiagram({ tables, relationships }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tables?.length) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Theming from CSS variables
    const style = getComputedStyle(document.documentElement);
    const bgSecondary = style.getPropertyValue('--bg-secondary').trim() || '#1a1a1a';
    const bgTertiary = style.getPropertyValue('--bg-tertiary').trim() || '#2a2a2a';
    const borderColor = style.getPropertyValue('--border').trim() || '#333';
    const textPrimary = style.getPropertyValue('--text-primary').trim() || '#e0e0e0';
    const textSecondary = style.getPropertyValue('--text-secondary').trim() || '#8b949e';
    const accent = style.getPropertyValue('--accent').trim() || '#38bdf8';

    ctx.clearRect(0, 0, W, H);

    const TABLE_W = 160;
    const TABLE_H_BASE = 36;
    const ROW_H = 20;
    const PADDING = 40;

    // Compute positions in a simple grid layout
    const cols = Math.max(1, Math.floor(W / (TABLE_W + PADDING * 2)));
    const positions = {};

    tables.forEach((table, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const columns = table.rows?.length ? Object.keys(table.rows[0]) : [];
      const tableH = TABLE_H_BASE + columns.length * ROW_H + 8;

      positions[table.tableName] = {
        x: PADDING + col * (TABLE_W + PADDING * 2),
        y: PADDING + row * (tableH + PADDING),
        w: TABLE_W,
        h: tableH,
        columns,
      };
    });

    // Draw relationships first (behind boxes)
    relationships.forEach(rel => {
      const from = positions[rel.fromTable];
      const to = positions[rel.toTable];
      if (!from || !to) return;

      const fromX = from.x + from.w;
      const fromY = from.y + TABLE_H_BASE / 2;
      const toX = to.x;
      const toY = to.y + TABLE_H_BASE / 2;

      ctx.beginPath();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.globalAlpha = 0.6;

      const cpX = (fromX + toX) / 2;
      ctx.moveTo(fromX, fromY);
      ctx.bezierCurveTo(cpX, fromY, cpX, toY, toX, toY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Arrowhead
      ctx.beginPath();
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.8;
      const angle = Math.atan2(toY - fromY, toX - fromX);
      ctx.translate(toX, toY);
      ctx.rotate(angle);
      ctx.moveTo(0, 0);
      ctx.lineTo(-8, -4);
      ctx.lineTo(-8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;

      // Label
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillStyle = textSecondary;
      ctx.globalAlpha = 0.85;
      ctx.fillText(`${rel.fromCol}`, (fromX + toX) / 2 - 20, (fromY + toY) / 2 - 4);
      ctx.globalAlpha = 1;
    });

    // Draw table boxes
    tables.forEach(table => {
      const pos = positions[table.tableName];
      if (!pos) return;
      const { x, y, w, h, columns } = pos;

      // Box shadow effect
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;

      // Box background
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fillStyle = bgSecondary;
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Header
      ctx.beginPath();
      ctx.roundRect(x, y, w, TABLE_H_BASE, [6, 6, 0, 0]);
      ctx.fillStyle = bgTertiary;
      ctx.fill();

      // Accent left border on header
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x, y + TABLE_H_BASE - 6);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.lineWidth = 1;

      // Table name
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.fillStyle = textPrimary;
      ctx.fillText(table.tableName, x + 12, y + TABLE_H_BASE / 2 + 4);

      // Row count badge
      const countLabel = `${table.rows?.length ?? 0} rows`;
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillStyle = textSecondary;
      ctx.fillText(countLabel, x + w - ctx.measureText(countLabel).width - 8, y + TABLE_H_BASE / 2 + 4);

      // Column list
      ctx.font = '11px Inter, system-ui, sans-serif';
      columns.forEach((col, ci) => {
        const colY = y + TABLE_H_BASE + ci * ROW_H + ROW_H / 2 + 6;

        if (ci % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.02)';
          ctx.fillRect(x + 1, y + TABLE_H_BASE + ci * ROW_H + 4, w - 2, ROW_H);
        }

        const lower = col.toLowerCase();
        const isPK = lower === 'id' || (lower.endsWith('id') && !lower.includes('_'));
        const isFK = lower.endsWith('_id') && lower !== 'id';
        const isTs = ['created_at', 'updated_at', 'deleted_at', 'timestamp'].some(d => lower.includes(d));

        let icon = '  ';
        let iconColor = textSecondary;
        if (isPK) { icon = '🔑'; iconColor = '#fbbf24'; }
        else if (isFK) { icon = '🔗'; iconColor = accent; }
        else if (isTs) { icon = '🕐'; iconColor = '#a78bfa'; }

        ctx.fillStyle = iconColor;
        ctx.font = '10px sans-serif';
        ctx.fillText(icon, x + 8, colY + 2);

        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillStyle = isFK ? accent : textPrimary;
        const maxW = w - 28;
        let colLabel = col;
        while (ctx.measureText(colLabel).width > maxW && colLabel.length > 4) {
          colLabel = colLabel.slice(0, -1);
        }
        if (colLabel !== col) colLabel += '…';
        ctx.fillText(colLabel, x + 24, colY + 2);
      });
    });
  }, [tables, relationships]);

  if (!tables?.length) return null;

  return (
    <div className="erd-canvas-wrapper">
      <canvas ref={canvasRef} className="erd-canvas" />
      {relationships.length > 0 && (
        <div className="erd-legend">
          <span className="erd-legend-item">
            <span className="erd-legend-line" />
            FK Relationship
          </span>
          <span className="erd-legend-item">🔑 PK</span>
          <span className="erd-legend-item">🔗 FK</span>
          <span className="erd-legend-item">🕐 TIMESTAMP</span>
        </div>
      )}
      {relationships.length === 0 && (
        <div className="erd-no-relations">
          No FK relationships detected between tables
        </div>
      )}
    </div>
  );
}