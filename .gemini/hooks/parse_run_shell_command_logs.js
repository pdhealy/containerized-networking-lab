#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const REPO_ROOT = process.cwd();
const LOGS_ROOT = path.join(REPO_ROOT, '.gemini', 'logs');
const BEFORE_OUTPUT = path.join(LOGS_ROOT, 'BeforeTool.md');
const AFTER_OUTPUT = path.join(LOGS_ROOT, 'AfterTool.md');

const MAX_OUTPUT_LINES = 30;

function listLogFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(listLogFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.log')) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseLogLine(line) {
  const detailsMarker = ' | DETAILS: ';
  const markerIndex = line.indexOf(detailsMarker);
  if (markerIndex === -1) return null;

  const header = line.slice(0, markerIndex);
  const detailsRaw = line.slice(markerIndex + detailsMarker.length).trim();
  if (!detailsRaw) return null;

  const tsMatch = header.match(/^\[([^\]]+)\]/);
  const timestamp = tsMatch ? tsMatch[1] : null;

  let action = null;
  if (header.includes('ACTION: BeforeTool')) action = 'BeforeTool';
  else if (header.includes('ACTION: AfterTool')) action = 'AfterTool';
  else return null;

  let details;
  try {
    details = JSON.parse(detailsRaw);
  } catch {
    return null;
  }

  if (!details || details.tool_name !== 'run_shell_command') return null;

  return { action, timestamp, details };
}

function formatTimestamp(iso) {
  if (!iso) return '';
  return iso.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

function truncateOutput(text) {
  const lines = text.split('\n');
  if (lines.length <= MAX_OUTPUT_LINES) return { text, truncated: false };
  const kept = MAX_OUTPUT_LINES - 1;
  return {
    text: lines.slice(0, kept).join('\n'),
    truncated: true,
    omitted: lines.length - kept,
  };
}

function extractDescription(details) {
  const raw = details?.tool_input?.description;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function extractCommand(details) {
  const raw = details?.tool_input?.command;
  return typeof raw === 'string' ? raw : '(no command)';
}

function toBeforeToolMarkdown(entry) {
  const { timestamp, details } = entry;
  const description = extractDescription(details);
  const command = extractCommand(details);
  const isBackground = details?.tool_input?.is_background === true;

  const meta = [
    timestamp ? `\`${formatTimestamp(timestamp)}\`` : null,
    isBackground ? '`background`' : null,
  ]
    .filter(Boolean)
    .join('  ');

  const descLine = description ? `- ${description}` : `- *(no description)*`;

  const parts = [];
  if (meta) parts.push(`> ${meta}`, '');
  parts.push(descLine, '', '```bash', command, '```');

  return parts.join('\n');
}

function toAfterToolMarkdown(entry) {
  const { timestamp, details } = entry;
  const description = extractDescription(details);
  const command = extractCommand(details);
  const isBackground = details?.tool_input?.is_background === true;

  const rawOutput =
    typeof details?.tool_response?.llmContent === 'string'
      ? details.tool_response.llmContent
      : typeof details?.tool_response?.returnDisplay === 'string'
        ? details.tool_response.returnDisplay
        : '';

  const meta = [
    timestamp ? `\`${formatTimestamp(timestamp)}\`` : null,
    isBackground ? '`background`' : null,
  ]
    .filter(Boolean)
    .join('  ');

  const descLine = description ? `- ${description}` : `- *(no description)*`;

  const outputTrimmed = rawOutput.trim();
  const { text: outputText, truncated, omitted } = truncateOutput(
    outputTrimmed.length > 0 ? outputTrimmed : 'Output: (empty)'
  );
  const truncationNotice = truncated ? `\n\n... *(${omitted} lines omitted)*` : '';

  const parts = [];
  if (meta) parts.push(`> ${meta}`, '');
  parts.push(
    descLine,
    '',
    '```bash',
    command,
    '```',
    '',
    '```plaintext',
    outputText + truncationNotice,
    '```'
  );

  return parts.join('\n');
}

function groupByDate(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = entry.timestamp ? entry.timestamp.slice(0, 10) : 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return groups;
}

function buildMarkdown(entries, formatFn, title) {
  const sorted = [...entries].sort((a, b) => {
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return a.timestamp.localeCompare(b.timestamp);
  });

  const groups = groupByDate(sorted);
  const generatedAt = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

  const lines = [
    `<!-- Generated: ${generatedAt} | Entries: ${entries.length} -->`,
    '',
    `# ${title}`,
    '',
  ];

  for (const [date, group] of groups) {
    lines.push(`## ${date}`, '');
    for (const entry of group) {
      lines.push(formatFn(entry), '', '---', '');
    }
  }

  return lines.join('\n');
}

function main() {
  const logFiles = listLogFiles(LOGS_ROOT);
  const beforeEntries = [];
  const afterEntries = [];

  for (const logFile of logFiles) {
    const content = fs.readFileSync(logFile, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      if (!line.includes('"tool_name":"run_shell_command"')) continue;
      const parsed = parseLogLine(line);
      if (!parsed) continue;
      if (parsed.action === 'BeforeTool') beforeEntries.push(parsed);
      else if (parsed.action === 'AfterTool') afterEntries.push(parsed);
    }
  }

  fs.mkdirSync(LOGS_ROOT, { recursive: true });
  fs.writeFileSync(
    BEFORE_OUTPUT,
    buildMarkdown(beforeEntries, toBeforeToolMarkdown, 'Shell Commands — Before'),
    'utf8'
  );
  fs.writeFileSync(
    AFTER_OUTPUT,
    buildMarkdown(afterEntries, toAfterToolMarkdown, 'Shell Commands — After'),
    'utf8'
  );

  console.log(
    `BeforeTool: ${beforeEntries.length} entries → ${BEFORE_OUTPUT}\n` +
    `AfterTool:  ${afterEntries.length} entries → ${AFTER_OUTPUT}`
  );
}

main();
