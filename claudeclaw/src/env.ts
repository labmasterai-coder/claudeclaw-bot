import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

export function readEnvFile(keys?: string[]): Record<string, string> {
    const envPath = path.join(PROJECT_ROOT, '.env')
    try {
        const content = readFileSync(envPath, 'utf-8')
        const result: Record<string, string> = {}
        for (const line of content.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) continue
            const eqIdx = trimmed.indexOf('=')
            if (eqIdx === -1) continue
            const key = trimmed.slice(0, eqIdx).trim()
            let value = trimmed.slice(eqIdx + 1).trim()
            // Strip surrounding quotes
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1)
            }
            result[key] = value
        }
        if (keys) {
            return Object.fromEntries(keys.map(k => [k, result[k] ?? '']))
        }
        return result
    } catch {
        return {}
    }
}
