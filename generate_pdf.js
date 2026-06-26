const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const mdPath = path.join(__dirname, 'ariyus_pitch_document.md');
const htmlPath = path.join(__dirname, 'ariyus_pitch_document.html');
const pdfPath = path.join(__dirname, 'ariyus_pitch_document.pdf');

// Read markdown source
let mdContent = fs.readFileSync(mdPath, 'utf8');

// A simple Markdown to HTML parser
function parseMarkdown(md) {
  let html = md;

  // Replace code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Replace headers
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

  // Replace horizontal rules
  html = html.replace(/^---$/gm, '<hr />');

  // Replace tables
  const lines = html.split('\n');
  let inTable = false;
  let tableContent = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableContent = ['<table>'];
      }
      // Parse table row
      const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      // Skip alignment lines (like | :--- | :--- |)
      if (cells.every(c => c.startsWith(':') || c.startsWith('-') || c.endsWith(':'))) {
        continue;
      }
      
      const tag = tableContent.length === 1 ? 'th' : 'td';
      const row = '<tr>' + cells.map(c => `<${tag}>${c.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</${tag}>`).join('') + '</tr>';
      tableContent.push(row);
    } else {
      if (inTable) {
        inTable = false;
        tableContent.push('</table>');
        // Replace original table lines with compiled table HTML
        // Find where the table started and substitute
        const tableHtml = tableContent.join('\n');
        lines.splice(i - tableContent.length + 1, tableContent.length - 1, tableHtml);
        i -= (tableContent.length - 2);
        tableContent = [];
      }
    }
  }
  html = lines.join('\n');

  // Replace lists
  html = html.replace(/^\* (.*?)$/gm, '<li>$1</li>');
  html = html.replace(/^- (.*?)$/gm, '<li>$1</li>');
  // Wrap list items
  html = html.replace(/(<li>.*?<\/li>)+/gs, '<ul>$&</ul>');

  // Replace bold / italics
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Paragraph blocks (ignore empty lines and lists/tables/headers/pre tags)
  const blocks = html.split('\n');
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (block && 
        !block.startsWith('<h') && 
        !block.startsWith('<u') && 
        !block.startsWith('<l') && 
        !block.startsWith('<t') && 
        !block.startsWith('<r') && 
        !block.startsWith('<d') && 
        !block.startsWith('<p') && 
        !block.startsWith('<c') && 
        !block.startsWith('<h') && 
        !block.startsWith('<f') && 
        !block.startsWith('<e') && 
        !block.startsWith('<a') && 
        !block.startsWith('<s') && 
        !block.startsWith('<hr')) {
      blocks[i] = `<p>${block}</p>`;
    }
  }
  html = blocks.join('\n');

  // Clean double nested list tags
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  return html;
}

const parsedBody = parseMarkdown(mdContent);

// Elegant print-styled HTML wrapper with Google Fonts and CSS page break variables
const htmlDocument = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ariyus-One: Executive Pitch Document</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      color: #1a1a2e;
      background: #ffffff;
      line-height: 1.6;
      margin: 40px;
      font-size: 11pt;
    }
    
    h1, h2, h3 {
      font-family: 'Outfit', sans-serif;
      color: #0f0c5d;
      font-weight: 700;
      page-break-after: avoid;
    }

    h1 {
      font-size: 28pt;
      border-bottom: 2px solid #00f2ff;
      padding-bottom: 10px;
      margin-top: 50px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    h2 {
      font-size: 18pt;
      margin-top: 35px;
      border-left: 4px solid #ff00c1;
      padding-left: 12px;
    }

    h3 {
      font-size: 13pt;
      margin-top: 20px;
      color: #7000ff;
    }

    p {
      margin-bottom: 15px;
      text-align: justify;
    }

    ul {
      margin-top: 5px;
      margin-bottom: 15px;
      padding-left: 20px;
    }

    li {
      margin-bottom: 6px;
    }

    hr {
      border: 0;
      height: 1px;
      background: #e2e8f0;
      margin: 40px 0;
      page-break-after: always; /* Force page break on --- */
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 25px 0;
      font-size: 10pt;
    }

    th, td {
      border: 1px solid #e2e8f0;
      padding: 10px 12px;
      text-align: left;
    }

    th {
      background-color: #f7fafc;
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      color: #0f0c5d;
    }

    pre {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 15px;
      overflow-x: auto;
      font-family: monospace;
      font-size: 9.5pt;
      margin: 20px 0;
    }

    code {
      font-family: monospace;
    }

    /* Cover Page Styling */
    .cover-page {
      height: 90vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      page-break-after: always;
      margin-top: 80px;
    }

    .cover-title {
      font-size: 38pt;
      color: #0f0c5d;
      margin-bottom: 10px;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-shadow: 0px 4px 6px rgba(0, 242, 255, 0.2);
    }

    .cover-subtitle {
      font-size: 16pt;
      color: #7000ff;
      margin-bottom: 40px;
      font-family: 'Outfit', sans-serif;
    }

    .cover-footer {
      margin-top: 150px;
      font-size: 10pt;
      color: #718096;
      border-top: 1px solid #e2e8f0;
      width: 60%;
      padding-top: 15px;
    }

    /* Print settings optimization */
    @media print {
      body {
        margin: 20mm;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-title">Ariyus-One</div>
    <div class="cover-subtitle">The Quantum Bio-Resonance Vocal Karaoke Studio & DAW</div>
    <div style="font-size: 12pt; color: #4a5568; margin-top: 50px;">
      <strong>In-Person Presentation Pitch Deck & Technical Manual</strong>
    </div>
    <div class="cover-footer">
      Compiled on: ${new Date().toLocaleDateString()}<br />
      Version 1.0.0 | Proprietary Resonance Engine Document
    </div>
  </div>

  <!-- Body Content -->
  ${parsedBody}

</body>
</html>
`;

fs.writeFileSync(htmlPath, htmlDocument);
console.log('HTML Document generated successfully.');

// Compile HTML to PDF using headless MS Edge (native on Windows)
const edgePath = '"C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe"';
const chromePath = '"C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe"';

const cmd = `${edgePath} --headless --disable-gpu --print-to-pdf="${pdfPath}" "${htmlPath}"`;

console.log('Compiling HTML to PDF via Microsoft Edge...');
exec(cmd, (err, stdout, stderr) => {
  if (err) {
    console.error('Edge compilation failed, checking for Chrome fallback...', err);
    
    // Attempt Google Chrome fallback
    const chromeCmd = `${chromePath} --headless --disable-gpu --print-to-pdf="${pdfPath}" "${htmlPath}"`;
    exec(chromeCmd, (cErr, cStdout, cStderr) => {
      if (cErr) {
        console.error('Chrome compilation failed too. Please print the HTML file directly using Chrome (Ctrl+P -> Save as PDF).', cErr);
      } else {
        console.log('PDF Compiled successfully via Google Chrome at:', pdfPath);
      }
    });
  } else {
    console.log('PDF Compiled successfully via Microsoft Edge at:', pdfPath);
  }
});

