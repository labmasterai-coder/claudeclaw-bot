import { getTurns, saveTurn, pruneOldTurns } from './db.js'

export function buildMemoryContext(chatId: string, n = 10): string {
    const turns = getTurns(chatId, n)
    if (turns.length === 0) return ''
    const lines = turns.map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
    return `[Previous conversation]\n${lines.join('\n')}`
}

export function saveConversationTurn(
    chatId: string,
    userMsg: string,
    assistantMsg: string
): void {
    if (userMsg.length <= 2 || userMsg.startsWith('/')) return
    saveTurn(chatId, 'user', userMsg)
    saveTurn(chatId, 'assistant', assistantMsg)
    pruneOldTurns(chatId, 50)
}
