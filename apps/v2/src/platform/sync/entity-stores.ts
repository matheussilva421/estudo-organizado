import { STORES } from '../indexeddb';

/** Entity stores all use the [profileId, id] key. */
export const STORE_BY_ENTITY_TYPE: Readonly<Record<string, string>> = {
  subject: STORES.subjects,
  edital: STORES.editais,
  'edital-discipline': STORES.editalDisciplines,
  assunto: STORES.assuntos,
  aula: STORES.aulas,
  'lesson-topic-link': STORES.lessonTopicLinks,
  'planning-scenario': STORES.planningScenarios,
  'plan-block': STORES.planningBlocks,
  'study-session': STORES.sessions,
  'habit-occurrence': STORES.habitOccurrences,
  'review-topic': STORES.reviewTopics,
  'review-policy': STORES.reviewPolicies,
  'review-commitment': STORES.reviewCommitments,
  'review-execution': STORES.reviewExecutions,
  'review-board-evidence': STORES.reviewBoardEvidence,
  'review-match': STORES.reviewMatches,
  'review-priority': STORES.reviewPriorities,
};
