import { state } from './store.js';
import { getPendingRevisoes, getPredictiveStats } from './logic.js';

// =============================================
// MÓDULO INTELIGENTE DE NOTIFICAÇÕES
// =============================================

export let hasNotificationPermission = false;
let notificationEngineInterval = null;
let lastNotifiedKeys = new Set(); // Para evitar spam da mesma notificação
let _lastNotifiedDate = ''; // Fecha o Set todo dia

function getNotifDateKey() {
    // Stable ISO date string independent of locale
    return new Date().toISOString().slice(0, 10);
}

function resetDailyNotifKeysIfNeeded() {
    const today = getNotifDateKey();
    if (today !== _lastNotifiedDate) {
        lastNotifiedKeys = new Set();
        _lastNotifiedDate = today;
    }
}


export async function initNotifications() {
    // 1. Checa a permissão atual ou solicita
    if (!('Notification' in window)) {
        console.warn('Este browser não suporta notificações nativas.');
        hasNotificationPermission = false;
    } else if (Notification.permission === 'granted') {
        hasNotificationPermission = true;
    } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        hasNotificationPermission = permission === 'granted';
    }

    // Aguarda carregar o estado para comecar
    setTimeout(() => {
        startNotificationEngine();
    }, 5000);
}

function isSilentHour() {
    const horaAtual = new Date().getHours();
    // Default silent mode: 22h às 08h
    const silenciosoInicio = state.config?.silentModeStart || 22;
    const silenciosoFim = state.config?.silentModeEnd || 8;

    if (silenciosoInicio > silenciosoFim) {
        return horaAtual >= silenciosoInicio || horaAtual < silenciosoFim;
    } else {
        return horaAtual >= silenciosoInicio && horaAtual < silenciosoFim;
    }
}

export function fireNotification(title, body, tagKey, requireInteraction = false) {
    resetDailyNotifKeysIfNeeded(); // Clear set on new day
    if (isSilentHour()) return;

    // Evita encher o saco do usuário com o mesmo texto
    const uniqueKey = `${getNotifDateKey()}-${tagKey}`;
    if (lastNotifiedKeys.has(uniqueKey)) return;

    if (hasNotificationPermission) {
        new Notification(title, {
            body: body,
            icon: 'favicon.ico', // Pega do root (PWA rules)
            tag: tagKey,
            requireInteraction
        });
    } else {
        // Fallback visual via Toast no app
        document.dispatchEvent(new CustomEvent('app:showToast', {
            detail: { msg: `🔔 ${title}: ${body}`, type: 'info', duration: 8000 }
        }));
    }

    lastNotifiedKeys.add(uniqueKey);
}

function checkTriggers() {
    resetDailyNotifKeysIfNeeded(); // Ensure fresh Set each day
    if (isSilentHour()) return;

    // 1. Checagem de Revisões Vencidas / Espaçadas
    const revisoesPendentes = getPendingRevisoes();
    if (revisoesPendentes && revisoesPendentes.length > 0) {
        const qtVencidas = revisoesPendentes.length;
        fireNotification(
            'Revisões Pendentes!',
            `Você tem ${qtVencidas} assunto(s) pendente(s) de revisão espaçada. Mantenha sua memória fresca!`,
            'alerta_revisao_diaria'
        );
    }

    // 2. Checagem Preditora (Desempenho Semanal em Risco)
    const metaHoras = state.config?.metas?.horasSemana || 20;
    const predStats = getPredictiveStats(metaHoras);

    // Alerta se está vermelho e só aciona a partir de Quarta-feira (dia 3 da semana) para dar tempo 
    const isLateWeek = predStats.daysRemaining <= 4 && predStats.daysRemaining > 0;

    if (predStats.status === 'vermelho' && isLateWeek) {
        fireNotification(
            'Meta Semanal em Alto Risco ⚠️',
            predStats.suggestion, // Vem direto do logic.js 
            'alerta_risco_metas'
        );
    } else if (predStats.status === 'amarelo' && isLateWeek) {
        fireNotification(
            'Atenção ao Ritmo 🟡',
            predStats.suggestion,
            'alerta_aviso_metas'
        );
    }
}

export function startNotificationEngine() {
    // Roda no boot
    checkTriggers();

    // Deixa rodando a cada 4 horas (1000 * 60 * 60 * 4)
    if (notificationEngineInterval) clearInterval(notificationEngineInterval);
    notificationEngineInterval = setInterval(() => {
        checkTriggers();
    }, 14400000);
}

export function stopNotificationEngine() {
    if (notificationEngineInterval) {
        clearInterval(notificationEngineInterval);
        notificationEngineInterval = null;
    }
}
