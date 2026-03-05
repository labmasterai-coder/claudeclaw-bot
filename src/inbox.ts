import fs from 'fs';
import path from 'path';
import os from 'os';

import { runAgent } from './agent.js';
import { logger } from './logger.js';

const INBOX_DIR = path.join(os.homedir(), '.claude-inbox', 'to-rc1');
const POLL_INTERVAL_MS = 10_000;

interface InboxTask {
  id: string;
  from: string;
  to: string;
  timestamp: string;
  priority: string;
  type: string;
  task: string;
  context?: string;
  callback?: {
    method: string;
    path: string;
    ref: string;
  };
  status: string;
}

/**
 * Start polling the RC1 inbox for task files.
 * @param notifyFn  Send a Telegram notification to Rolland
 */
export function startInboxWatcher(
  notifyFn: (text: string) => void,
): void {
  fs.mkdirSync(INBOX_DIR, { recursive: true });
  logger.info({ dir: INBOX_DIR }, 'Inbox watcher started');

  setInterval(() => void pollInbox(notifyFn), POLL_INTERVAL_MS);
}

async function pollInbox(notifyFn: (text: string) => void): Promise<void> {
  let files: string[];
  try {
    files = fs.readdirSync(INBOX_DIR).filter(
      (f) => f.startsWith('task-') && f.endsWith('.json'),
    );
  } catch {
    return;
  }

  for (const file of files) {
    const filePath = path.join(INBOX_DIR, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const task: InboxTask = JSON.parse(raw);

      if (task.status !== 'pending') continue;

      logger.info({ taskId: task.id, from: task.from }, 'Processing inbox task');
      notifyFn(`<b>Inbox task received</b>\nFrom: <code>${task.from}</code>\nTask: ${escapeHtml(task.task.slice(0, 200))}`);

      // Mark as processing
      task.status = 'processing';
      fs.writeFileSync(filePath, JSON.stringify(task, null, 2));

      // Run through Claude agent
      const result = await runAgent(
        `[Inter-agent task from ${task.from}] ${task.task}${task.context ? `\n\nContext: ${task.context}` : ''}`,
        undefined, // new session
        () => {}, // no typing indicator
      );

      // Write response to callback path
      if (task.callback?.path) {
        const callbackDir = task.callback.path.replace(/^~/, os.homedir());
        fs.mkdirSync(callbackDir, { recursive: true });
        const response = {
          id: `response-${task.callback.ref}`,
          ref: task.callback.ref,
          from: 'rc1',
          to: task.from,
          timestamp: new Date().toISOString(),
          type: 'task_response',
          result: result.text ?? 'No response generated.',
          status: 'completed',
        };
        fs.writeFileSync(
          path.join(callbackDir, `response-${task.callback.ref}.json`),
          JSON.stringify(response, null, 2),
        );
      }

      // Rename original to .done
      const donePath = filePath.replace(/\.json$/, '.done');
      fs.renameSync(filePath, donePath);

      notifyFn(
        `<b>Inbox task completed</b>\nID: <code>${task.id}</code>\nResult: ${escapeHtml((result.text ?? 'No response').slice(0, 300))}`,
      );

      logger.info({ taskId: task.id }, 'Inbox task completed');
    } catch (err) {
      logger.error({ file, err }, 'Failed to process inbox task');
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
