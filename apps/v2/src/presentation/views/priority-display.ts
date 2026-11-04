import type { PriorityCategory, PriorityTarget } from '../../application/experience-queries';
import type { AppRoute } from '../routing';

export const PRIORITY_CATEGORY_LABELS: Record<PriorityCategory, string> = {
  SESSAO_ATIVA: 'Sessão ativa',
  INTEGRIDADE: 'Integridade local',
  DIAGNOSTICO: 'Diagnóstico local',
  REVISAO_ATRASADA: 'Revisão atrasada',
  ATRASO_REAL: 'Atraso real',
  REVISAO_HOJE: 'Revisão de hoje',
  COMPROMISSO_PLANEJADO: 'Compromisso planejado',
  ATIVIDADE_FUTURA: 'Atividade futura',
  ORIENTACAO: 'Orientação',
};

export function routeForTarget(target: PriorityTarget): AppRoute {
  return { module: target, entityId: null, query: {}, invalid: false };
}

export function priorityTone(category: PriorityCategory): string {
  if (category === 'SESSAO_ATIVA') return 'active';
  if (category === 'INTEGRIDADE') return 'integrity';
  if (category === 'DIAGNOSTICO') return 'future';
  if (category === 'REVISAO_ATRASADA' || category === 'ATRASO_REAL') return 'late';
  if (category === 'REVISAO_HOJE' || category === 'COMPROMISSO_PLANEJADO') return 'today';
  if (category === 'ORIENTACAO') return 'hint';
  return 'future';
}

