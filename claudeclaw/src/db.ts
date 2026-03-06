import Database from 'better-sqlite3'
import path from 'path'
import { STORE_DIR } from './config.js'
import { mkdirSync } from 'fs'

mkdirSync(STORE_DIR, { recursive: true })

const db = new Database(path.join(STORE_DIR, 'claudeclaw.db'))
db.pragma('journal_mode = WAL')

export function initDatabase(): void {
    db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      chat_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)
}

export function getSession(chatId: string): string | null {
    const row = db.prepare('SELECT session_id FROM sessions WHERE chat_id = ?').get(chatId) as { session_id: string } | undefined
    return row?.session_id ?? null
}

export function setSession(chatId: string, sessionId: string): void {
    db.prepare(`
    INSERT INTO sessions (chat_id, session_id, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET session_id = excluded.session_id, updated_at = excluded.updated_at
  `).run(chatId, sessionId, Date.now())
}

export function clearSession(chatId: string): void {
    db.prepare('DELETE FROM sessions WHERE chat_id = ?').run(chatId)
}

// Simple memory: last N turns
export function getTurns(chatId: string, n = 10): Array<{ role: string; content: string }> {
    return db.prepare(
        'SELECT role, content FROM (SELECT * FROM turns WHERE chat_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC'
    ).all(chatId, n) as Array<{ role: string; content: string }>
}

export function saveTurn(chatId: string, role: 'user' | 'assistant', content: string): void {
    db.prepare(
        'INSERT INTO turns (chat_id, role, content, created_at) VALUES (?, ?, ?, ?)'
    ).run(chatId, role, content, Date.now())
}

export function pruneOldTurns(chatId: string, keep = 50): void {
    db.prepare(`
    DELETE FROM turns WHERE chat_id = ? AND id NOT IN (
      SELECT id FROM turns WHERE chat_id = ? ORDER BY id DESC LIMIT ?
    )
  `).run(chatId, chatId, keep)
}
