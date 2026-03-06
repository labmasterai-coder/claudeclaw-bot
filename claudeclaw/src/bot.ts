import { Bot, Context } from 'grammy'
import { TELEGRAM_BOT_TOKEN, ALLOWED_CHAT_ID, MAX_MESSAGE_LENGTH } from './config.js'
import { runAgent, clearHistory } from './agent.js'
import { buildMemoryContext, saveConversationTurn } from './memory.js'
import { clearSession } from './db.js'
import { logger } from './logger.js'

export function formatForTelegram(text: string): string {
    // Protect code blocks
    const codeBlocks: string[] = []
    let result = text.replace(/```[\s\S]*?```/g, (match) => {
        codeBlocks.push(match)
        return `\x00CODE${codeBlocks.length - 1}\x00`
    })

    // Convert markdown to Telegram HTML
    result = result
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/__(.*?)__/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/_(.*?)_/g, '<i>$1</i>')
        .replace(/~~(.*?)~~/g, '<s>$1</s>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
        .replace(/- \[ \]/g, '☐')
        .replace(/- \[x\]/gi, '☑')
        .replace(/---/g, '')

    // Restore code blocks as <pre><code>
    result = result.replace(/\x00CODE(\d+)\x00/g, (_, idx) => {
        const block = codeBlocks[parseInt(idx)]
        const match = block.match(/```(\w*)\n?([\s\S]*?)```/)
        if (match) {
            const code = match[2].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            return `<pre><code>${code}</code></pre>`
        }
        return block
    })

    return result.trim()
}

export function splitMessage(text: string, limit = MAX_MESSAGE_LENGTH): string[] {
    if (text.length <= limit) return [text]
    const chunks: string[] = []
    let remaining = text
    while (remaining.length > 0) {
        if (remaining.length <= limit) {
            chunks.push(remaining)
            break
        }
        let cutAt = remaining.lastIndexOf('\n', limit)
        if (cutAt === -1) cutAt = limit
        chunks.push(remaining.slice(0, cutAt))
        remaining = remaining.slice(cutAt).trim()
    }
    return chunks
}

export function isAuthorised(chatId: number): boolean {
    if (!ALLOWED_CHAT_ID) return true // first-run mode
    return String(chatId) === ALLOWED_CHAT_ID
}

export async function handleMessage(
    ctx: Context,
    rawText: string
): Promise<void> {
    const chatId = ctx.chat?.id
    if (!chatId) return
    if (!isAuthorised(chatId)) {
        await ctx.reply('Unauthorised.')
        return
    }

    const chatIdStr = String(chatId)

    // Build memory context from last 10 turns
    const memoryCtx = buildMemoryContext(chatIdStr, 10)

    // Keep typing indicator alive
    const sendTyping = () => ctx.api.sendChatAction(chatId, 'typing').catch(() => { })
    await sendTyping()

    const { text } = await runAgent(rawText, chatIdStr, memoryCtx, sendTyping)

    if (!text) {
        await ctx.reply('⚠️ No response from Claude. Try again.')
        return
    }

    // Save to memory
    saveConversationTurn(chatIdStr, rawText, text)

    // Format and send
    const formatted = formatForTelegram(text)
    const chunks = splitMessage(formatted)
    for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: 'HTML' }).catch(async () => {
            // Fallback: send as plain text if HTML fails
            await ctx.reply(text.slice(0, MAX_MESSAGE_LENGTH))
        })
    }
}

export function createBot(): Bot {
    const bot = new Bot(TELEGRAM_BOT_TOKEN)

    bot.command('start', async (ctx) => {
        const chatId = ctx.chat?.id ?? 0
        await ctx.reply(
            `👋 ClaudeClaw running!\n\nYour chat ID: <code>${chatId}</code>\n\nSend me any message and I'll respond with Claude.`,
            { parse_mode: 'HTML' }
        )
    })

    bot.command('chatid', async (ctx) => {
        await ctx.reply(`Your chat ID: <code>${ctx.chat?.id}</code>`, { parse_mode: 'HTML' })
    })

    bot.command('newchat', async (ctx) => {
        const chatId = String(ctx.chat?.id ?? '')
        clearSession(chatId)
        clearHistory(chatId)
        await ctx.reply('🔄 Conversation cleared. Starting fresh!')
    })

    bot.command('forget', async (ctx) => {
        const chatId = String(ctx.chat?.id ?? '')
        clearSession(chatId)
        clearHistory(chatId)
        await ctx.reply('🔄 Conversation cleared.')
    })

    bot.on('message:text', async (ctx) => {
        const text = ctx.message.text
        if (text.startsWith('/')) return
        await handleMessage(ctx, text)
    })

    bot.catch((err) => {
        logger.error({ err: err.error }, 'Bot error')
    })

    return bot
}
