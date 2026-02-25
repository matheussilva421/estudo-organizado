// =============================================
// HELPERS & UTILITIES (Pure Functions)
// =============================================

export function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function esc(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export let _todayCache = null;
export function invalidateTodayCache() { _todayCache = null; }
export function todayStr() {
    if (!_todayCache) _todayCache = new Date().toISOString().split('T')[0];
    return _todayCache;
}

export function formatDate(str) {
    if (!str) return '';
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function pad(n) { return String(n).padStart(2, '0'); }

export function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function getEventStatus(evento) {
    const today = todayStr();
    if (evento.status === 'estudei') return 'estudei';
    if (!evento.data || evento.data > today) return 'agendado';
    if (evento.data < today) return 'atrasado';
    return 'agendado';
}

export function cutoffDateStr(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}

export const HABIT_TYPES = [
    { key: 'questoes', label: 'Questões', icon: '📝', color: '#3b82f6' },
    { key: 'revisao', label: 'Revisão', icon: '🔄', color: '#10b981' },
    { key: 'discursiva', label: 'Discursiva', icon: '✍️', color: '#f59e0b' },
    { key: 'simulado', label: 'Simulado', icon: '🎯', color: '#ef4444' },
    { key: 'leitura', label: 'Leitura Seca', icon: '📖', color: '#8b5cf6' },
    { key: 'informativo', label: 'Informativos', icon: '📰', color: '#06b6d4' },
    { key: 'sumula', label: 'Súmulas', icon: '⚖️', color: '#6366f1' }
];

export function getHabitType(key) {
    return HABIT_TYPES.find(h => h.key === key);
}
