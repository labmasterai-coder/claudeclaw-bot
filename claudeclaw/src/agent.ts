import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY, CLAUDE_MODEL, PROJECT_ROOT } from './config.js'
import { logger } from './logger.js'

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY })

// In-memory session store: chatId -> message history
const sessionHistory: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map()

export function getHistory(chatId: string): Array<{ role: 'user' | 'assistant'; content: string }> {
    return sessionHistory.get(chatId) ?? []
}

export function clearHistory(chatId: string): void {
    sessionHistory.delete(chatId)
}

export async function runAgent(
    message: string,
    chatId: string,
    memoryContext: string,
    onTyping?: () => void
): Promise<{ text: string | null }> {
    const history = getHistory(chatId)

    // Build user message with optional memory context
    const userMessage = memoryContext
        ? `${memoryContext}\n\n---\n\n${message}`
        : message

    history.push({ role: 'user', content: userMessage })

    // Start typing refresh
    let typingInterval: ReturnType<typeof setInterval> | null = null
    if (onTyping) {
        typingInterval = setInterval(onTyping, 4000)
    }

    try {
        const response = await client.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 4000,
            system: `You are a helpful AI assistant running on a server and accessible via Telegram.
You can help with any task. Be concise and clear in your responses.
Project root: ${PROJECT_ROOT}`,
            messages: history.map(h => ({ role: h.role, content: h.content })),
        })

        const text = response.content
            .filter(b => b.type === 'text')
            .map(b => (b as { type: 'text'; text: string }).text)
            .join('')

        history.push({ role: 'assistant', content: text })
        sessionHistory.set(chatId, history)

        return { text }
    } catch (err) {
        logger.error({ err }, 'runAgent error')
        return { text: null }
    } finally {
        if (typingInterval) clearInterval(typingInterval)
    }
}
