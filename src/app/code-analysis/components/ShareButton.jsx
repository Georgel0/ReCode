"use client";
import { useState, useRef, useEffect } from 'react';

function buildAuditHTML(analysisData, code, language) {
  const esc = (str) => String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const SEV_COLORS = {
    Critical: '#ef4444', High: '#f97316', Medium: '#d4a017', Low: '#3b82f6',
  };

  const severityBadge = (sev) =>
    `<span style="background:${SEV_COLORS[sev] ?? '#3b82f6'}1a;color:${SEV_COLORS[sev] ?? '#3b82f6'};border:1px solid ${SEV_COLORS[sev] ?? '#3b82f6'}4d;padding:2px 10px;border-radius:99px;font-size:0.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em">${esc(sev)}</span>`;

  const renderIssueList = (items) => {
    if (!items?.length) return '<p style="color:#64748b;font-size:.875rem">None found.</p>';
    return items.map(it => `
      <div style="border:1px solid #1e293b;border-radius:10px;padding:14px 16px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
          ${it.severity ? severityBadge(it.severity) : severityBadge('Low')}
          ${it.location ? `<code style="background:#0f172a;color:#94a3b8;font-size:.71rem;padding:3px 8px;border-radius:5px;border:1px solid #1e293b">${esc(it.location)}</code>` : ''}
        </div>
        <p style="margin:0 0 10px;font-size:.875rem;color:#e2e8f0">${esc(it.issue)}</p>
        <div style="background:#10b9810d;border:1px solid #10b98129;border-left:3px solid #10b981;padding:10px 14px;border-radius:0 8px 8px 0">
          <div style="color:#10b981;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">↳ Resolution</div>
          <p style="margin:0;font-size:.85rem;color:#94a3b8">${esc(it.resolution)}</p>
        </div>
      </div>`).join('');
  };

  const renderSimpleList = (arr) =>
    arr?.length
      ? `<ul style="list-style:none;padding:0;margin:0">${arr.map(s => `<li style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:10px 14px;margin-bottom:6px;font-size:.875rem;color:#e2e8f0">→ ${esc(s)}</li>`).join('')}</ul>`
      : '<p style="color:#64748b;font-size:.875rem">None found.</p>';

  const section = (title, icon, content) => `
    <div style="margin-bottom:28px">
      <h3 style="font-size:.75rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;display:flex;align-items:center;gap:6px">${icon} ${esc(title)}</h3>
      ${content}
    </div>`;

  const score = analysisData.score ?? 0;
  const circ = Math.round((score / 100) * 100);

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Code Audit Report</title>
      <style>
        *{box-sizing:border-box}
        body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0f1e;color:#e2e8f0;min-height:100vh;padding:32px 16px}
        .wrap{max-width:900px;margin:0 auto}
        h1{font-size:1.6rem;font-weight:800;margin:0 0 4px;color:#f8fafc}
        h2{font-size:1rem;font-weight:700;margin:0 0 16px;color:#f8fafc;padding-bottom:8px;border-bottom:1px solid #1e293b}
        code{font-family:'Fira Code',monospace}
        .card{background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px 24px;margin-bottom:20px}
        pre{background:#020712;border:1px solid #1e293b;border-radius:8px;padding:16px;overflow-x:auto;font-size:.8rem;color:#94a3b8;max-height:320px}
        .tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px}
        .tab-btn{background:#0f172a;border:1px solid #1e293b;color:#94a3b8;padding:6px 14px;border-radius:7px;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s}
        .tab-btn:hover,.tab-btn.active{background:#1e293b;color:#6366f1;border-color:#6366f1}
        .tab-content{display:none}.tab-content.active{display:block}
        .meta{font-size:.75rem;color:#475569;margin-top:24px}
      </style>
    </head>
    <body>
      <div class="wrap">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:24px">
          <div>
            <p style="margin:0 0 4px;font-size:.68rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.08em">Code Audit Report</p>
            <h1>Audit Results</h1>
            <p style="margin:0;font-size:.875rem;color:#64748b">Language: <strong style="color:#94a3b8">${esc(language)}</strong> · Generated ${new Date().toLocaleString()}</p>
          </div>
          <div style="position:relative;width:72px;height:72px;flex-shrink:0">
            <svg viewBox="0 0 36 36" style="width:72px;height:72px;transform:rotate(-90deg)">
              <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="#1e293b" stroke-width="3"/>
              <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="#6366f1" stroke-width="3" stroke-linecap="round" stroke-dasharray="${circ}, 100.53"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1">
              <span style="font-size:1.2rem;font-weight:800;color:#6366f1">${score}</span>
              <span style="font-size:.55rem;color:#64748b;font-weight:700;text-transform:uppercase">/100</span>
            </div>
          </div>
        </div>

        <div class="card" style="border-left:4px solid #6366f1">
          <p style="margin:0 0 6px;font-size:.68rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.08em">Executive Summary</p>
          <p style="margin:0;font-size:.925rem;line-height:1.65;color:#e2e8f0">${esc(analysisData.summary)}</p>
        </div>

        <div class="tabs">
          ${['complexity', 'security', 'bugs', 'improvements', 'bestPractices', 'testing', 'architecture']
      .map((t, i) => `<button class="tab-btn${i === 0 ? ' active' : ''}" onclick="showTab('${t}')">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}
        </div>

        <div id="tab-complexity" class="tab-content active card">
          <h2>Complexity</h2>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
            <div style="background:#0a0f1e;border:1px solid #1e293b;border-radius:10px;padding:14px;display:flex;align-items:center;gap:12px">
              <div style="width:38px;height:38px;background:#1e293b;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#6366f1;font-size:1rem">⏱</div>
              <div><div style="font-size:.62rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.07em">Time</div><div style="font-weight:700;color:#f8fafc;font-family:monospace">${esc(analysisData.complexity?.time)}</div></div>
            </div>
            <div style="background:#0a0f1e;border:1px solid #1e293b;border-radius:10px;padding:14px;display:flex;align-items:center;gap:12px">
              <div style="width:38px;height:38px;background:#1e293b;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#6366f1;font-size:1rem">🗂</div>
              <div><div style="font-size:.62rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.07em">Space</div><div style="font-weight:700;color:#f8fafc;font-family:monospace">${esc(analysisData.complexity?.space)}</div></div>
            </div>
          </div>
          ${renderSimpleList(analysisData.complexity?.explanation)}
          ${analysisData.complexity?.bottleneck ? `<div style="background:#0a0f1e;border:1px solid #1e293b;border-radius:10px;padding:14px;margin-top:12px"><strong style="color:#6366f1;font-size:.78rem">Bottleneck:</strong><p style="margin:4px 0 0;color:#94a3b8;font-size:.875rem">${esc(analysisData.complexity.bottleneck)}</p></div>` : ''}
          ${analysisData.complexity?.metrics ? `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px">
            ${[['Cyclomatic', analysisData.complexity.metrics.cyclomatic], ['Cognitive', analysisData.complexity.metrics.cognitive], ['Maintainability', analysisData.complexity.metrics.maintainability]].map(([n, v]) => `<div style="background:#0a0f1e;border:1px solid #1e293b;border-radius:9px;padding:12px"><div style="font-size:.68rem;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px">${n}</div><div style="font-weight:800;font-size:1.1rem;color:#6366f1">${v}</div></div>`).join('')}
          </div>` : ''}
        </div>

        <div id="tab-security" class="tab-content card">
          <h2>Security</h2>${renderIssueList(analysisData.security)}
        </div>
        <div id="tab-bugs" class="tab-content card">
          <h2>Bugs</h2>${renderIssueList(analysisData.bugs)}
        </div>
        <div id="tab-improvements" class="tab-content card">
          <h2>Improvements</h2>${renderIssueList(analysisData.improvements)}
        </div>
        <div id="tab-bestPractices" class="tab-content card">
          <h2>Best Practices</h2>${renderIssueList(analysisData.bestPractices)}
        </div>
        <div id="tab-testing" class="tab-content card">
          <h2>Testing</h2>
          <h3 style="font-size:.75rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">Edge Cases</h3>
          ${renderSimpleList(analysisData.testing?.edgeCases)}
          <h3 style="font-size:.75rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin:18px 0 10px">Unit Tests</h3>
          ${renderSimpleList(analysisData.testing?.unitTests)}
        </div>
        <div id="tab-architecture" class="tab-content card">
          <h2>Architecture</h2>
          <h3 style="font-size:.75rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">Code Smells</h3>
          ${renderSimpleList(analysisData.architecture?.smells)}
          <h3 style="font-size:.75rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin:18px 0 10px">Dependencies</h3>
          ${renderSimpleList(analysisData.architecture?.dependencies)}
        </div>

        ${code ? `
        <div class="card" style="margin-top:12px">
          <h2>Audited Source Code</h2>
          <pre><code>${esc(code)}</code></pre>
        </div>` : ''}

        <p class="meta">Generated by Code Auditor · ${new Date().toISOString()}</p>
      </div>
      <script>
      function showTab(id){
        document.querySelectorAll('.tab-content').forEach(el=>el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el=>el.classList.remove('active'));
        document.getElementById('tab-'+id)?.classList.add('active');
        event.currentTarget.classList.add('active');
      }
      </script>
    </body>
  </html>`;
}

export function ShareButton({ analysisData, code, language = 'javascript' }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleExportHTML = () => {
    const html = buildAuditHTML(analysisData, code, language);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-report-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const handleCopyJSON = async () => {
    const summary = {
      score: analysisData.score,
      summary: analysisData.summary,
      complexity: { time: analysisData.complexity?.time, space: analysisData.complexity?.space },
      issueCount: {
        security: analysisData.security?.length ?? 0,
        bugs: analysisData.bugs?.length ?? 0,
        improvements: analysisData.improvements?.length ?? 0,
        bestPractices: analysisData.bestPractices?.length ?? 0,
      },
      criticalIssues: [
        ...(analysisData.security || []),
        ...(analysisData.bugs || []),
      ].filter(i => i.severity === 'Critical' || i.severity === 'High')
        .map(i => ({ severity: i.severity, location: i.location, issue: i.issue })),
      metrics: analysisData.complexity?.metrics,
    };
    await navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  };

  return (
    <div className="a-share-wrapper" ref={menuRef}>
      <button
        className="secondary-button a-btn-sm a-share-trigger"
        onClick={() => setOpen(v => !v)}
        title="Share / Export"
      >
        <i className={`fa-solid ${open ? 'fa-xmark' : 'fa-share-nodes'}`} />
        <span>Share</span>
      </button>

      {open && (
        <div className="a-share-menu">
          <button className="a-share-option" onClick={handleExportHTML}>
            <span className="a-share-option-icon"><i className="fa-solid fa-file-code" /></span>
            <span className="a-share-option-text">
              <strong>Export HTML</strong>
              <small>Self-contained report · drop in Notion or a PR</small>
            </span>
          </button>
          <button className="a-share-option" onClick={handleCopyJSON}>
            <span className="a-share-option-icon">
              <i className={`fa-solid ${copied ? 'fa-check' : 'fa-clipboard-list'}`} />
            </span>
            <span className="a-share-option-text">
              <strong>{copied ? 'Copied!' : 'Copy JSON summary'}</strong>
              <small>Score, metrics &amp; critical issues</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}