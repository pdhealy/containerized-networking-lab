#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const MAX_OUTPUT_LINES = 30;
const MAX_PAYLOAD_SIZE = 50 * 1024 * 1024; // 50MB

// --- Core hook infrastructure ---

function emitEmptyObject() {
  process.stdout.write('{}\n');
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    let size = 0;
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      size += Buffer.byteLength(chunk, 'utf8');
      if (size > MAX_PAYLOAD_SIZE) {
        process.stderr.write(`Payload exceeded ${MAX_PAYLOAD_SIZE} bytes. Truncating.\n`);
        process.stdin.pause();
        return resolve(data);
      }
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', (err) => {
      process.stderr.write(`Stdin error: ${err.message}\n`);
      resolve('');
    });
  });
}

function parseInputPayload(inputData) {
  try {
    return JSON.parse(inputData);
  } catch {
    // Fallback: cursor-based loop to find valid JSON without splitting the whole string
    let fallback = null;
    let startIdx = 0;
    
    while (startIdx < inputData.length) {
      let newlineIdx = inputData.indexOf('\n', startIdx);
      if (newlineIdx === -1) {
        newlineIdx = inputData.length;
      }
      
      const line = inputData.slice(startIdx, newlineIdx).trim();
      if (line) {
        try {
          const candidate = JSON.parse(line);
          if (candidate && typeof candidate === 'object') {
            fallback = candidate;
            if (
              Object.prototype.hasOwnProperty.call(candidate, 'hook_event_name') ||
              Object.prototype.hasOwnProperty.call(candidate, 'tool_name') ||
              Object.prototype.hasOwnProperty.call(candidate, 'tool_input') ||
              Object.prototype.hasOwnProperty.call(candidate, 'tool_response')
            ) {
              return candidate; // Return the first valid one we find
            }
          }
        } catch {
          // Keep scanning lines for valid JSON.
        }
      }
      
      startIdx = newlineIdx + 1;
    }
    
    return fallback;
  }
}

function getCurrentDateUtc() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentTimestampUtc() {
  // ISO string is already standardized UTC (e.g. 2026-05-01T12:00:00.000Z)
  return new Date().toISOString().replace(/\.\d{3}Z$/, '+0000');
}

function buildDetails(payload) {
  const keys = [
    'tool_name',
    'tool_input',
    'tool_response',
    'session_id',
    'source',
    'reason',
    'trigger',
    'notification_type',
  ];

  const details = {};
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== null) {
      details[key] = payload[key];
    }
  }

  if (Object.keys(details).length === 0) {
    details.raw_data_keys = Object.keys(payload);
  }

  return details;
}

function resolveProjectCwd(payload) {
  return typeof payload.cwd === 'string' && payload.cwd.trim().length > 0
    ? payload.cwd
    : process.cwd();
}

function resolveTimestamp(payload) {
  return typeof payload.timestamp === 'string' && payload.timestamp.trim().length > 0
    ? payload.timestamp
    : getCurrentTimestampUtc();
}

function writeDebugLog(baseCwd, message) {
  try {
    const date = getCurrentDateUtc();
    const debugLogFile = path.join(baseCwd, '.gemini', 'logs', date, 'hook_debug.log');
    fs.mkdirSync(path.dirname(debugLogFile), { recursive: true });
    fs.appendFileSync(debugLogFile, `${message}\n`, 'utf8');
  } catch (err) {
    process.stderr.write(`Failed to write debug log: ${err.message}\n`);
  }
}

function writeActionLog(payload) {
  const cwd = resolveProjectCwd(payload);
  const date = getCurrentDateUtc();
  const logDir = path.join(cwd, '.gemini', 'logs', date);
  
  const logFile = path.join(logDir, `actions.jsonl`);
  
  const timestamp = resolveTimestamp(payload);
  const action =
    payload.hook_event_name === undefined || payload.hook_event_name === null
      ? 'UnknownAction'
      : String(payload.hook_event_name);
  const details = buildDetails(payload);
  
  const logEntry = {
    timestamp,
    action,
    details
  };

  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf8');
  } catch (err) {
    process.stderr.write(`Failed to write action log: ${err.message}\n`);
  }
}

// --- Shell command markdown helpers ---

function formatTimestamp(iso) {
  if (!iso) return '';
  return iso
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC')
    .replace(/Z$/, ' UTC')
    .replace(/\+0000$/, ' UTC');
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

function getToolMetadata(toolInput, timestamp) {
  const description = typeof toolInput?.description === 'string' && toolInput.description.trim() 
    ? toolInput.description.trim() 
    : null;
  const command = typeof toolInput?.command === 'string' ? toolInput.command : '(no command)';
  const isBackground = toolInput?.is_background === true;

  const meta = [
    timestamp ? `\`${formatTimestamp(timestamp)}\`` : null,
    isBackground ? '`background`' : null,
  ]
    .filter(Boolean)
    .join('  ');

  const descLine = description ? `- ${description}` : `- *(no description)*`;

  return { command, meta, descLine };
}

function buildBeforeToolBlock(timestamp, toolInput) {
  const { command, meta, descLine } = getToolMetadata(toolInput, timestamp);

  const parts = [];
  if (meta) parts.push(`> ${meta}`, '');
  parts.push(descLine, '', '```bash', command, '```');

  return parts.join('\n');
}

function buildAfterToolBlock(timestamp, toolInput, toolResponse) {
  const { command, meta, descLine } = getToolMetadata(toolInput, timestamp);

  const rawOutput =
    typeof toolResponse?.llmContent === 'string'
      ? toolResponse.llmContent
      : typeof toolResponse?.returnDisplay === 'string'
        ? toolResponse.returnDisplay
        : '';

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

function writeShellCommandMd(payload) {
  if (payload.tool_name !== 'run_shell_command') return;

  const action = payload.hook_event_name;
  if (action !== 'BeforeTool' && action !== 'AfterTool') return;

  const cwd = resolveProjectCwd(payload);
  const logsDir = path.join(cwd, '.gemini', 'logs');
  
  const outputFile = path.join(logsDir, `${action}.md`);
  const timestamp = resolveTimestamp(payload);

  const block =
    action === 'BeforeTool'
      ? buildBeforeToolBlock(timestamp, payload.tool_input)
      : buildAfterToolBlock(timestamp, payload.tool_input, payload.tool_response);

  try {
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(outputFile, block + '\n\n---\n\n', 'utf8');
  } catch (err) {
    process.stderr.write(`Failed to write markdown log: ${err.message}\n`);
  }
}

// --- Entry point ---

async function main() {
  const inputData = await readStdin();
  if (!/\S/.test(inputData)) {
    emitEmptyObject();
    return;
  }

  const payload = parseInputPayload(inputData);
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    emitEmptyObject();
    return;
  }

  writeActionLog(payload);
  writeShellCommandMd(payload);
  emitEmptyObject();
}

main()
  .catch((error) => {
    const message =
      error && error.stack ? String(error.stack) : `Error: ${error ? String(error) : 'Unknown'}`;
    writeDebugLog(process.cwd(), message);
    process.stderr.write(`${message}\n`);
    emitEmptyObject();
  })
  .finally(() => {
    process.exit(0);
  });
