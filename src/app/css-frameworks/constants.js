export const TARGET_FRAMEWORKS = [
 { value: 'tailwind', label: 'Tailwind CSS' },
 { value: 'bootstrap', label: 'Bootstrap 5' },
 { value: 'sass', label: 'SASS/SCSS' },
 { value: 'less', label: 'LESS' },
];

export const MODES = [
 { id: 'css', label: 'CSS Only', icon: 'fa-code' },
 { id: 'html', label: 'HTML + CSS', icon: 'fa-brands fa-html5' }
];

export const generatePreviewDoc = (html, css, type) => {
 if (!html) return '';
 
 const CDNS = {
  tailwind: `<script src="https://cdn.tailwindcss.com"></script>`,
  bootstrap: `<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">`
 };
 
 return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${CDNS[type] || ''}
        <style>
          body { padding: 20px; font-family: sans-serif; }
          ${css || ''}
        </style>
      </head>
      <body>${html}</body>
    </html>
  `;
};