import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs'
import path from 'path'
import http from 'http'
import { createBot } from './bot.js'
import { initDatabase } from './db.js'
import { STORE_DIR, TELEGRAM_BOT_TOKEN } from './config.js'
import { logger } from './logger.js'

const PID_FILE = path.join(STORE_DIR, 'claudeclaw.pid')

function acquireLock(): void {
    if (existsSync(PID_FILE)) {
        try {
            const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim())
            process.kill(pid, 0)
            process.kill(pid, 'SIGTERM')
            logger.info({ pid }, 'Killed stale instance')
        } catch {
            // process not found, ignore
        }
    }
    writeFileSync(PID_FILE, String(process.pid))
}

function releaseLock(): void {
    try { unlinkSync(PID_FILE) } catch { /* ignore */ }
}

async function main(): Promise<void> {
    if (!TELEGRAM_BOT_TOKEN) {
        logger.error('TELEGRAM_BOT_TOKEN is not set. Exiting.')
        process.exit(1)
    }

    acquireLock()
    initDatabase()

    const bot = createBot()

    // Railway Healthcheck Server
    const port = process.env.PORT || 8080
    const server = http.createServer((req, res) => {
        res.writeHead(200)
        res.end('ClaudeClaw is running!')
    })
    server.listen(port, () => {
        logger.info({ port }, 'Healthcheck server listening')
    })

    const shutdown = async () => {
        logger.info('Shutting down...')
        releaseLock()
        server.close()
        await bot.stop()
        process.exit(0)
    }

    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)

    logger.info('🐾 ClaudeClaw starting...')
    await bot.start()
}

main().catch((err) => {
    logger.error({ err }, 'Fatal error')
    process.exit(1)
})
