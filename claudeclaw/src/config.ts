import { fileURLToPath } from 'url'
import path from 'path'
import { readEnvFile } from './env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const PROJECT_ROOT = path.resolve(__dirname, '..')
export const STORE_DIR = path.join(PROJECT_ROOT, 'store')
export const MAX_MESSAGE_LENGTH = 4096
export const TYPING_REFRESH_MS = 4000

const env = readEnvFile()

export const TELEGRAM_BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN'] ?? env['TELEGRAM_BOT_TOKEN'] ?? ''
export const ALLOWED_CHAT_ID = process.env['ALLOWED_CHAT_ID'] ?? env['ALLOWED_CHAT_ID'] ?? ''
export const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY'] ?? env['ANTHROPIC_API_KEY'] ?? ''
export const CLAUDE_MODEL = process.env['CLAUDE_MODEL'] ?? env['CLAUDE_MODEL'] ?? 'claude-opus-4-5'
