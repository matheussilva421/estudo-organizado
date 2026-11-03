import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ContentSnapshot } from '../application/content-service';
import {
  ReviewService,
  type ReviewImportPreview,
  type ReviewPlacementPreview,
} from '../application/review-service';
import { LocalPlanningRepository } from '../platform/local-planning-repository';
import { LocalReviewRepository } from '../platform/local-review-repository';
import { LocalSessionRepository } from '../platform/local-session-repository';
import type {
  BoardEvidence,
  ReviewAssessment,
  ReviewCommitment,
  ReviewCoverage,
  ReviewPolicy,
  ReviewPolicyImpactPreview,
  ReviewTopicOverride,
  ReviewSuggestion,
  ReviewTopicLink,
  WeakPointProjection,
} from '../domain/review';
import { useFocusScroll } from './use-focus-scroll';
type Props = {
  profileId: string;
  content: ContentSnapshot;
  locked: boolean;
  onNotice: (message: string | null) => void;
  focusId?: string | null;
};

type MatchCandidate = {
  topic: ReviewTopicLink;
  score: number;
  reason: string;
};

function newId(): string {
  return crypto.randomUUID();
}

function commitmentLabel(value: ReviewCommitment['status']): string {
  if (value === 'FULFILLED') return 'Cumprida';
  if (value === 'PARTIALLY_FULFILLED') return 'Parcial';
  if (value === 'CANCELLED') return 'Cancelada';
  return 'Pendente';
}

function weakStatusLabel(value: WeakPointProjection['status']): string {
  if (value === 'TREND_SUPPORTED') return 'Tendência sustentada';
  if (value === 'DESCRIPTIVE_ONLY') return 'Apenas descritivo';
  return 'Dados insuficientes';
}

function trendLabel(value: WeakPointProjection['trend']): string {
  if (value === 'IMPROVING') return 'melhorando';
  if (value === 'WORSENING') return 'piorando';
  if (value === 'STABLE') return 'estável';
  return 'inconclusiva';
}

function matchReasonLabel(reason: string): string {
  if (reason === 'exact-label') return 'correspondência exata';
  if (reason === 'text-contains-label') return 'texto contém o rótulo';
  return 'correspondência textual';
}

function projectionReasonLabel(reason: string | undefined): string {
  if (reason === 'INPUTS_CHANGED') return 'os fatos mudaram';
  if (reason === 'ALGORITHM_CHANGED') return 'a regra de cálculo foi atualizada';
  if (reason === 'STORED_STALE') return 'o cache salvo está desatualizado';
  return 'os dados de origem mudaram';
}

function formatInstant(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function ReviewWorkspace({ profileId, content, locked, onNotice, focusId = null }: Props) {
  const service = useMemo(
    () =>
      new ReviewService(
        new LocalReviewRepository(),
        new LocalSessionRepository(),
        new LocalPlanningRepository(),
      ),
    [],
  );
  const [policy, setPolicy] = useState<ReviewPolicy | null>(null);
  const [topics, setTopics] = useState<ReviewTopicLink[]>([]);
  const [commitments, setCommitments] = useState<ReviewCommitment[]>([]);
  useFocusScroll(focusId, commitments.length);
  const [suggestions, setSuggestions] = useState<ReviewSuggestion[]>([]);
  const [weakPoints, setWeakPoints] = useState<WeakPointProjection[]>([]);
  const [boardEvidence, setBoardEvidence] = useState<BoardEvidence[]>([]);
  const [reminders, setReminders] = useState<Awaited<ReturnType<ReviewService['reminders']>> | null>(null);
  const [priority, setPriority] = useState<Awaited<ReturnType<ReviewService['previewPriorities']>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedEditalId, setSelectedEditalId] = useState('');
  const [selectedDisciplineId, setSelectedDisciplineId] = useState('');
  const [selectedAssuntoId, setSelectedAssuntoId] = useState('');
  const [defaultDuration, setDefaultDuration] = useState('20');
  const [autoApprove, setAutoApprove] = useState(false);
  const [assessmentByCommitment, setAssessmentByCommitment] = useState<Record<string, ReviewAssessment>>({});
  const [rescheduleDates, setRescheduleDates] = useState<Record<string, string>>({});
  const [placement, setPlacement] = useState<{ commitmentId: string; preview: ReviewPlacementPreview } | null>(null);
  const [boardTitle, setBoardTitle] = useState('');
  const [boardText, setBoardText] = useState('');
  const [boardSample, setBoardSample] = useState('');
  const [boardDenominator, setBoardDenominator] = useState('');
  const [boardMatches, setBoardMatches] = useState<Record<string, { candidates: MatchCandidate[]; ambiguous: boolean }>>({});
  const [importPreview, setImportPreview] = useState<ReviewImportPreview | null>(null);
  const [overrideTopicKey, setOverrideTopicKey] = useState('');
  const [overrideInterval, setOverrideInterval] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [policyImpact, setPolicyImpact] = useState<ReviewPolicyImpactPreview | null>(null);
  const [overrideMode, setOverrideMode] = useState<'SET' | 'REMOVE'>('SET');
  const [overrideBaseUpdatedAt, setOverrideBaseUpdatedAt] = useState<string | null>(null);
  const settingsHydratedRef = useRef(false);
  const [externalEnabled, setExternalEnabled] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'UNSUPPORTED'
  >(() => (typeof Notification === 'undefined' ? 'UNSUPPORTED' : Notification.permission));
  const [projectionStatus, setProjectionStatus] = useState<
    Awaited<ReturnType<ReviewService['weakPointProjectionStatus']>> | null
  >(null);

  const editais = content.editais.filter((edital) => edital.status === 'ACTIVE');
  const archivedEditalIds = content.editais
    .filter((edital) => edital.status !== 'ACTIVE')
    .map((edital) => edital.id);
  const disciplines = content.links.filter(
    (link) => link.editalId === selectedEditalId && link.status === 'ACTIVE',
  );
  const assuntos = content.assuntos.filter(
    (assunto) => assunto.editalDisciplineId === selectedDisciplineId,
  );
  const reminderItems = reminders
    ? [
        ...reminders.overdue.map((commitment) => ({ commitment, label: 'Atrasada' })),
        ...reminders.dueToday.map((commitment) => ({ commitment, label: 'Hoje' })),
        ...reminders.upcoming.map((commitment) => ({ commitment, label: 'Próxima' })),
      ]
    : [];

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const nextPolicy = await service.getPolicy(profileId);
      setPolicy(nextPolicy);
      setDefaultDuration(String(nextPolicy.defaultDurationMinutes));
      setAutoApprove(nextPolicy.autoApprove);
      const [nextTopics, nextCommitments, nextSuggestions, nextWeak, nextBoard, nextReminders] =
        await Promise.all([
          service.listTopics(profileId),
          service.listCommitments(profileId),
          service.generateSuggestions(profileId),
          service.weakPoints(profileId),
          service.listBoardEvidence(profileId),
          service.reminders(profileId),
        ]);
      setTopics(nextTopics);
      setCommitments(nextCommitments);
      setSuggestions(nextSuggestions);
      setWeakPoints(nextWeak);
      setBoardEvidence(nextBoard);
      setReminders(nextReminders);
      try {
        setProjectionStatus(await service.weakPointProjectionStatus(profileId));
      } catch {
        setProjectionStatus(null);
      }
      if (!settingsHydratedRef.current) {
        setExternalEnabled(nextReminders.settings.externalNotifications);
        setQuietStart(nextReminders.settings.quietStart);
        setQuietEnd(nextReminders.settings.quietEnd);
        settingsHydratedRef.current = true;
      }
    } catch {
      onNotice('Não foi possível carregar a área de revisões.');
    } finally {
      setBusy(false);
    }
  }, [onNotice, profileId, service]);

  useEffect(() => {
    // The workspace loads once on mount; all writes remain explicit commands.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function createTopic(): Promise<void> {
    if (locked || busy) return;
    const discipline = disciplines.find((item) => item.id === selectedDisciplineId);
    const assunto = assuntos.find((item) => item.id === selectedAssuntoId);
    if (!discipline || !assunto) {
      onNotice('Selecione disciplina e assunto da F2.');
      return;
    }
    setBusy(true);
    try {
      const result = await service.createTopic(
        profileId,
        {
          editalId: discipline.editalId,
          editalDisciplineId: discipline.id,
          assuntoId: assunto.id,
          label: assunto.title,
        },
        newId(),
      );
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? 'Tópico de revisão vinculado por ID.'
          : 'Não foi possível criar o tópico de revisão.',
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy(): Promise<void> {
    if (locked || busy) return;
    const minutes = Number(defaultDuration);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 180) {
      const message = 'Duração padrão deve ficar entre 5 e 180 minutos.';
      setPolicyError(message);
      onNotice(message);
      return;
    }
    setPolicyError(null);
    setBusy(true);
    try {
      const result = await service.updatePolicy(
        profileId,
        { defaultDurationMinutes: Math.round(minutes), autoApprove },
        newId(),
      );
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? 'Política de revisão versionada neste perfil.'
          : 'Não foi possível salvar a política.',
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function previewOverride(remove = false): Promise<void> {
    if (locked || busy || !policy) return;
    const topic = topics.find((item) => item.canonicalTopicKey === overrideTopicKey);
    if (!topic) {
      onNotice('Selecione um assunto vinculado para ajustar.');
      return;
    }
    const interval = Number(overrideInterval);
    if (!remove && overrideInterval.trim() && (!Number.isInteger(interval) || interval < 1 || interval > 3650)) {
      onNotice('Intervalo do ajuste deve ficar entre 1 e 3650 dias.');
      return;
    }
    if (!remove && overrideNote.length > 200) {
      onNotice('A observação do ajuste deve ter no máximo 200 caracteres.');
      return;
    }
    setBusy(true);
    try {
      setOverrideMode(remove ? 'REMOVE' : 'SET');
      setOverrideBaseUpdatedAt(policy.overrides?.[topic.canonicalTopicKey]?.updatedAt ?? null);
      const nextOverrides: Record<string, ReviewTopicOverride> = { ...policy.overrides };
      if (remove) {
        delete nextOverrides[topic.canonicalTopicKey];
      } else {
        nextOverrides[topic.canonicalTopicKey] = {
          ...(nextOverrides[topic.canonicalTopicKey] ?? {}),
          canonicalTopicKey: topic.canonicalTopicKey,
          ...(overrideInterval.trim() ? { initialIntervalDays: interval } : {}),
          ...(overrideNote.trim() ? { note: overrideNote.trim() } : {}),
          updatedAt: new Date().toISOString(),
        };
      }
      const result = await service.previewPolicyChange(profileId, { overrides: nextOverrides });
      if (result.kind !== 'READY') {
        onNotice('Ajuste recusado pela validação da política.');
        setPolicyImpact(null);
        return;
      }
      setPolicyImpact(result);
      onNotice(result.explanation);
    } finally {
      setBusy(false);
    }
  }

  async function applyOverride(): Promise<void> {
    if (!policyImpact || locked || busy) return;
    const topic = topics.find((item) => item.canonicalTopicKey === overrideTopicKey);
    if (!topic) {
      onNotice('Selecione o assunto do ajuste antes de aplicar.');
      return;
    }
    setBusy(true);
    try {
      const override: ReviewTopicOverride | null =
        overrideMode === 'REMOVE'
          ? null
          : {
              canonicalTopicKey: topic.canonicalTopicKey,
              ...(overrideInterval.trim()
                ? { initialIntervalDays: Number(overrideInterval) }
                : {}),
              ...(overrideNote.trim() ? { note: overrideNote.trim() } : {}),
              updatedAt: new Date().toISOString(),
            };
      const result = await service.applyPolicyOverride(
        profileId,
        topic.canonicalTopicKey,
        override,
        overrideBaseUpdatedAt,
        newId(),
      );
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? overrideMode === 'REMOVE'
            ? 'Ajuste removido; a política foi versionada e nenhum fato foi reescrito.'
            : 'Ajuste por assunto versionado; compromissos e execuções foram preservados.'
          : result.kind === 'CONFLICT'
            ? 'A política mudou desde a prévia. Revise o impacto novamente.'
            : 'Não foi possível aplicar o ajuste.',
      );
      if (result.kind === 'LOCAL_COMMITTED') {
        setPolicyImpact(null);
        setOverrideInterval('');
        setOverrideNote('');
        setOverrideMode('SET');
        setOverrideBaseUpdatedAt(null);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveReminderPreferences(): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    try {
      const result = await service.updateReminderSettings(profileId, {
        externalNotifications: externalEnabled,
        quietStart,
        quietEnd,
      });
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? 'Preferências de lembrete salvas neste perfil.'
          : 'Não foi possível salvar as preferências de lembrete.',
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function requestNotifications(): Promise<void> {
    if (typeof Notification === 'undefined') {
      onNotice('Este navegador não oferece notificações externas; a central local continua ativa.');
      return;
    }
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission !== 'granted') {
      onNotice('Permissão de notificação não concedida; a central local continua ativa.');
      return;
    }
    setExternalEnabled(true);
    const result = await service.updateReminderSettings(profileId, {
      externalNotifications: true,
      quietStart,
      quietEnd,
    });
    onNotice(
      result.kind === 'LOCAL_COMMITTED'
          ? 'Avisos externos autorizados; o envio é manual enquanto o app está aberto e não há promessa com o app fechado.'
        : 'Permissão concedida, mas a preferência não foi gravada.',
    );
    await refresh();
  }

  async function testExternalNotification(): Promise<void> {
    if (!reminders) return;
    if (typeof Notification === 'undefined') {
      onNotice('Notificação externa indisponível; a central local permanece funcional.');
      return;
    }
    if (Notification.permission !== 'granted') {
      onNotice('Conceda a permissão de notificação antes de testar o aviso externo.');
      return;
    }
    const pending = [
      ...reminders.overdue,
      ...reminders.dueToday,
      ...reminders.upcoming,
    ].find((item) => !reminders.dismissedIds.includes(item.id));
    if (!pending) {
      onNotice('Nenhuma revisão pendente para avisar.');
      return;
    }
    const claim = await service.claimTestNotification(profileId);
    if (claim === 'DISABLED') {
      onNotice('Ative a preferência de avisos externos antes de testar.');
      return;
    }
    if (claim === 'SUPPRESSED_QUIET') {
      onNotice('Horário de silêncio: o aviso externo foi suprimido; a central local continua disponível.');
      return;
    }
    if (claim === 'DUPLICATE') {
      onNotice('Este aviso já foi emitido por outra aba; nada foi duplicado.');
      return;
    }
    try {
      new Notification('Revisão pendente', {
        body: `${pending.label} · vence ${pending.currentDueDate}`,
        tag: `review-${pending.id}-${pending.currentDueDate}`,
      });
      onNotice('Aviso externo emitido uma única vez; a central local continua sendo a fonte.');
    } catch {
      onNotice('O navegador recusou o aviso externo; a central local permanece funcional.');
    }
  }

  async function dismissReminder(commitment: ReviewCommitment): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    try {
      const result = await service.dismissReminder(profileId, commitment.id);
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? 'Aviso dispensado; o compromisso continua pendente e não foi cancelado.'
          : 'Não foi possível dispensar o aviso.',
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function rebuildProjection(): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    try {
      const result = await service.rebuildWeakPointsProjection(profileId, { batchSize: 50 });
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? `Projeção reconstruída em ${result.value.batches} lote(s), ${result.value.rows} linha(s).`
          : result.kind === 'BLOCKED'
            ? 'Os fatos mudaram durante a reconstrução; nada foi publicado.'
            : result.kind === 'CONFLICT'
              ? 'Outra aba publicou uma versão mais nova; nada foi sobrescrito.'
              : result.kind === 'FAILED'
                ? 'Falha de armazenamento durante a reconstrução; nada foi publicado.'
                : 'A reconstrução não pôde ser publicada.',
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function applySuggestion(suggestion: ReviewSuggestion): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    try {
      const result = await service.applySuggestion(profileId, suggestion, newId());
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? 'Revisão confirmada e compromisso registrado.'
          : result.kind === 'CONFLICT' && result.code === 'DUPLICATE_COMMITMENT'
            ? 'Já existe compromisso equivalente; nada foi duplicado.'
            : 'Não foi possível confirmar a revisão.',
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function autoApproveSuggestions(): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    try {
      const result = await service.applyAutoApproved(profileId, newId());
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? `${result.value.length} compromisso(s) aprovados dentro do horizonte opt-in.`
          : result.kind === 'INVALID'
            ? 'Autoaprovação está desligada; confirme manualmente.'
            : 'Autoaprovação não pôde ser aplicada.',
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function execute(commitment: ReviewCommitment, coverage: ReviewCoverage): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    try {
      const result = await service.recordExecution(
        profileId,
        {
          commitmentId: commitment.id,
          canonicalTopicKey: commitment.canonicalTopicKey,
          civilDate: service.today(),
          assessment: assessmentByCommitment[commitment.id] ?? 'UNRATED',
          coverage,
          provenance: 'ui',
        },
        newId(),
      );
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? coverage === 'FULL'
            ? 'Revisão concluída com cobertura integral.'
            : 'Execução parcial registrada; saldo preservado.'
          : 'Não foi possível registrar a execução.',
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reschedule(commitment: ReviewCommitment): Promise<void> {
    const dueDate = rescheduleDates[commitment.id] ?? commitment.currentDueDate;
    if (locked || busy || !dueDate) return;
    setBusy(true);
    try {
      const result = await service.reschedule(profileId, commitment.id, dueDate, newId());
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? 'Compromisso reagendado com vencimento original preservado.'
          : 'Não foi possível reagendar.',
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancel(commitment: ReviewCommitment): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    try {
      const result = await service.cancel(profileId, commitment.id, newId());
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? 'Compromisso cancelado; o histórico permanece.'
          : 'Não foi possível cancelar.',
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function previewPlacement(commitment: ReviewCommitment): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    try {
      const preview = await service.previewPlacement(
        profileId,
        commitment.id,
        commitment.currentDueDate,
      );
      setPlacement({ commitmentId: commitment.id, preview });
      onNotice(
        preview.kind === 'READY'
          ? 'Encaixe F3 pronto para confirmação.'
          : preview.kind === 'UNALLOCATED'
            ? preview.explanation
            : 'Sem cenário ativo para encaixe.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function applyPlacement(): Promise<void> {
    if (!placement || locked || busy) return;
    setBusy(true);
    try {
      const result = await service.applyPlacement(
        profileId,
        placement.commitmentId,
        placement.preview,
        newId(),
      );
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? 'Encaixe F3 aplicado e vínculo conferido.'
          : result.kind === 'BLOCKED' && result.reason === 'PLAN_BLOCK_CREATED_LINK_PENDING'
            ? 'Bloco F3 criado; vínculo da revisão exige reconciliação.'
            : 'Encaixe não confirmado.',
      );
      setPlacement(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function importBoard(): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    try {
      const result = await service.saveBoardEvidence(
        profileId,
        {
          title: boardTitle,
          text: boardText,
          ...(boardSample.trim() ? { sampleSize: Number(boardSample) } : {}),
          ...(boardDenominator.trim() ? { denominator: Number(boardDenominator) } : {}),
        },
        newId(),
      );
      if (result.kind !== 'LOCAL_COMMITTED') {
        onNotice('Fonte de banca recusada pela validação.');
        return;
      }
      const match = await service.matchBoardEvidence(
        profileId,
        result.value.id,
        selectedEditalId || undefined,
        archivedEditalIds,
      );
      setBoardMatches((current) => ({ ...current, [result.value.id]: match }));
      setBoardTitle('');
      setBoardText('');
      setBoardSample('');
      setBoardDenominator('');
      onNotice(
        match.candidates.length > 0
          ? `Fonte importada; ${match.candidates.length} candidato(s) para revisão.`
          : 'Fonte importada; nenhuma correspondência automática.',
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function confirmMatch(evidenceId: string, candidate: MatchCandidate): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    try {
      const result = await service.confirmMatch(
        profileId,
        {
          evidenceId,
          topicLinkId: candidate.topic.id,
          canonicalTopicKey: candidate.topic.canonicalTopicKey,
          editalId: candidate.topic.editalId,
          assuntoId: candidate.topic.assuntoId,
          decision: 'ACCEPTED',
          score: candidate.score,
          reason: candidate.reason,
        },
        newId(),
      );
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? 'Correspondência confirmada explicitamente.'
          : 'Não foi possível confirmar a correspondência.',
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function updatePriority(): Promise<void> {
    if (!selectedEditalId || locked || busy) return;
    setBusy(true);
    try {
      const next = await service.previewPriorities(profileId, selectedEditalId);
      setPriority(next);
      const saved = await service.savePriority(profileId, next, newId());
      onNotice(
        saved.kind === 'LOCAL_COMMITTED'
          ? 'Prioridade contextual explicada e versionada.'
          : saved.kind === 'CONFLICT'
            ? 'A projeção ficou obsoleta antes da publicação; recalcule novamente.'
            : 'Não foi possível publicar a prioridade.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function exportData(): Promise<void> {
    const raw = await service.exportData(profileId);
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'revisoes-f5.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportCsv(): Promise<void> {
    const raw = await service.exportCsv(profileId);
    const url = URL.createObjectURL(new Blob([raw], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'revisoes-f5.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function selectImportFile(file: File | undefined): Promise<void> {
    if (!file) return;
    const raw = await file.text();
    setImportPreview(service.previewImport(profileId, raw));
  }

  async function applyImport(): Promise<void> {
    if (!importPreview || locked || busy) return;
    setBusy(true);
    try {
      const result = await service.applyImport(profileId, importPreview, newId());
      onNotice(
        result.kind === 'LOCAL_COMMITTED'
          ? 'Importação F5 aplicada com recibos locais.'
          : 'Importação parcial ou recusada; nada foi declarado completo.',
      );
      setImportPreview(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="session-workspace" aria-labelledby="review-title" data-testid="review-workspace">
      <h2 id="review-title">Revisões e inteligência</h2>
      <p className="empty-state">
        Sugestões explicáveis, compromissos próprios, evidências F4 e banca contextual.
        Nenhuma consulta cria sessão, tempo ou bloco F3 por conta própria.
      </p>
      <p className="session-status" data-testid="review-status">
        {busy ? 'Gravando…' : reminders?.message ?? 'Central local pronta.'}
      </p>

      <article className="session-card" data-testid="review-policy">
        <h3>Política versionada</h3>
        <div className="session-grid">
          <label>
            Duração padrão (min)
            <input
              type="number"
              min={5}
              max={180}
              value={defaultDuration}
              aria-invalid={policyError !== null}
              aria-describedby={policyError ? 'review-policy-error' : undefined}
              onChange={(event) => setDefaultDuration(event.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(event) => setAutoApprove(event.target.checked)}
            />
            Autoaprovar sugestões no horizonte (opt-in, desligado por padrão)
          </label>
        </div>
        {policyError ? (
          <p id="review-policy-error" className="hint">
            {policyError}
          </p>
        ) : null}
        <div className="session-actions">
          <button type="button" onClick={() => void savePolicy()} disabled={locked || busy}>
            Gravar política
          </button>
          <button
            type="button"
            onClick={() => void autoApproveSuggestions()}
            disabled={locked || busy || !autoApprove}
          >
            Aplicar opt-in no horizonte
          </button>
        </div>
        <p className="hint">
          Parâmetros conservadores e reversíveis; política v{policy?.version ?? 1}; mudanças recalculam projeções e não reescrevem fatos.
        </p>
      </article>

      <article className="session-card" data-testid="review-policy-overrides">
        <h3>Ajustes por assunto</h3>
        <p className="hint">
          Cada ajuste cria uma nova versão da política. A prévia abaixo mostra o efeito
          nas sugestões; compromissos e execuções existentes não são reescritos.
        </p>
        <div className="session-grid">
          <label>
            Assunto vinculado
            <select
              value={overrideTopicKey}
              onChange={(event) => {
                const key = event.target.value;
                setOverrideTopicKey(key);
                setPolicyImpact(null);
                const override = key ? policy?.overrides?.[key] : undefined;
                setOverrideInterval(
                  override?.initialIntervalDays ? String(override.initialIntervalDays) : '',
                );
                setOverrideNote(override?.note ?? '');
              }}
            >
              <option value="">Selecione</option>
              {topics.map((topic) => (
                <option key={topic.canonicalTopicKey} value={topic.canonicalTopicKey}>
                  {topic.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Intervalo inicial (dias)
            <input
              type="number"
              min={1}
              max={3650}
              value={overrideInterval}
              onChange={(event) => {
                setOverrideInterval(event.target.value);
                setPolicyImpact(null);
              }}
            />
          </label>
          <label>
            Observação (opcional)
            <input
              maxLength={200}
              value={overrideNote}
              onChange={(event) => {
                setOverrideNote(event.target.value);
                setPolicyImpact(null);
              }}
            />
          </label>
        </div>
        <div className="session-actions">
          <button
            type="button"
            onClick={() => void previewOverride()}
            disabled={locked || busy || !overrideTopicKey}
          >
            Prévia do impacto
          </button>
          <button
            type="button"
            onClick={() => void applyOverride()}
            disabled={locked || busy || !policyImpact}
          >
            {overrideMode === 'REMOVE' ? 'Aplicar remoção' : 'Aplicar ajuste'}
          </button>
          <button
            type="button"
            onClick={() => void previewOverride(true)}
            disabled={locked || busy || !overrideTopicKey}
          >
            Prévia da remoção
          </button>
        </div>
        <div data-testid="review-policy-impact" aria-live="polite">
          {policyImpact ? (
            <>
            <p className="hint">
              {policyImpact.explanation} Política v{policyImpact.nextPolicy.version}.
            </p>
            {policyImpact.rows.length === 0 ? (
              <p className="hint">Nenhum assunto vinculado para comparar.</p>
            ) : (
              <ul>
                {policyImpact.rows.map((row) => (
                  <li key={row.canonicalTopicKey} data-changed={row.changed}>
                    {row.label}: {row.previousDueDate} → {row.nextDueDate} ({row.previousIntervalDays}d →{' '}
                    {row.nextIntervalDays}d) {row.changed ? '· muda' : '· sem mudança'}
                  </li>
                ))}
              </ul>
            )}
            </>
          ) : null}
        </div>
        {policy && Object.keys(policy.overrides ?? {}).length > 0 ? (
          <p className="hint">
            Ajustes salvos:{' '}
            {Object.keys(policy.overrides)
              .map(
                (key) =>
                  topics.find((topic) => topic.canonicalTopicKey === key)?.label ??
                  'assunto sem vínculo visível',
              )
              .join(', ')}.
          </p>
        ) : (
          <p className="hint">Nenhum ajuste por assunto salvo.</p>
        )}
      </article>

      <article className="session-card" data-testid="review-topics">
        <h3>Tópicos de revisão</h3>
        <div className="session-grid">
          <label>
            Edital
            <select
              value={selectedEditalId}
              onChange={(event) => {
                setSelectedEditalId(event.target.value);
                setSelectedDisciplineId('');
                setSelectedAssuntoId('');
              }}
            >
              <option value="">Selecione</option>
              {editais.map((edital) => (
                <option key={edital.id} value={edital.id}>{edital.title}</option>
              ))}
            </select>
          </label>
          <label>
            Disciplina
            <select
              value={selectedDisciplineId}
              onChange={(event) => {
                setSelectedDisciplineId(event.target.value);
                setSelectedAssuntoId('');
              }}
            >
              <option value="">Selecione</option>
              {disciplines.map((link) => (
                <option key={link.id} value={link.id}>
                  {content.subjects.find((subject) => subject.id === link.subjectId)?.title ?? link.displayAlias ?? link.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assunto
            <select value={selectedAssuntoId} onChange={(event) => setSelectedAssuntoId(event.target.value)}>
              <option value="">Selecione</option>
              {assuntos.map((assunto) => (
                <option key={assunto.id} value={assunto.id}>{assunto.title}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="session-actions">
          <button type="button" onClick={() => void createTopic()} disabled={locked || busy}>
            Criar tópico de revisão
          </button>
        </div>
        {topics.length === 0 ? (
          <p className="hint">Nenhum tópico vinculado. O vínculo é explícito e usa IDs da F2.</p>
        ) : (
          <ul>
            {topics.map((topic) => (
              <li key={topic.id}>
                {topic.label}
                {archivedEditalIds.includes(topic.editalId) ? ' · edital arquivado (vínculo preservado)' : ''}
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="session-card" data-testid="review-suggestions">
        <h3>Sugestões</h3>
        {suggestions.length === 0 ? (
          <p className="hint">Nenhuma sugestão calculada.</p>
        ) : (
          <ul>
            {suggestions.map((suggestion) => (
              <li key={suggestion.key}>
                {suggestion.label} · {suggestion.dueDate} · {suggestion.durationMinutes} min ·{' '}
                {suggestion.explanation}
                <div className="session-actions">
                  <button
                    type="button"
                    onClick={() => void applySuggestion(suggestion)}
                    disabled={locked || busy}
                  >
                    Confirmar revisão
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="session-card" data-testid="review-agenda">
        <h3>Agenda de compromissos</h3>
        {commitments.length === 0 ? (
          <p className="hint">Nenhum compromisso confirmado.</p>
        ) : (
          <ul>
            {commitments.map((commitment) => (
              <li key={commitment.id} data-entity-id={commitment.id}>
                {commitment.label} · {commitmentLabel(commitment.status)} · vence{' '}
                {commitment.currentDueDate} · cobertura {commitment.coverage}
                {commitment.planBlockId ? ' · bloco F3 vinculado' : ''}
                {commitment.status !== 'CANCELLED' && commitment.status !== 'FULFILLED' ? (
                  <div className="session-actions">
                    <label>
                      Avaliação
                      <select
                        value={assessmentByCommitment[commitment.id] ?? 'UNRATED'}
                        onChange={(event) =>
                          setAssessmentByCommitment((current) => ({
                            ...current,
                            [commitment.id]: event.target.value as ReviewAssessment,
                          }))
                        }
                      >
                        <option value="UNRATED">Sem avaliação</option>
                        <option value="FORGOT">Esqueci</option>
                        <option value="PARTIAL">Parcial</option>
                        <option value="GOOD">Boa retenção</option>
                      </select>
                    </label>
                    <button type="button" onClick={() => void execute(commitment, 'PARTIAL')} disabled={locked || busy}>
                      Registrar parcial
                    </button>
                    <button type="button" onClick={() => void execute(commitment, 'FULL')} disabled={locked || busy}>
                      Concluir
                    </button>
                    <label>
                      Reagendar
                      <input
                        type="date"
                        value={rescheduleDates[commitment.id] ?? commitment.currentDueDate}
                        onChange={(event) =>
                          setRescheduleDates((current) => ({
                            ...current,
                            [commitment.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button type="button" onClick={() => void reschedule(commitment)} disabled={locked || busy}>
                      Reagendar
                    </button>
                    <button type="button" onClick={() => void previewPlacement(commitment)} disabled={locked || busy}>
                      Prévia F3
                    </button>
                    <button type="button" onClick={() => void cancel(commitment)} disabled={locked || busy}>
                      Cancelar
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {placement ? (
          <div data-testid="review-placement-preview">
            <p className="hint">{placement.preview.kind === 'READY' ? placement.preview.explanation : placement.preview.kind === 'UNALLOCATED' ? placement.preview.explanation : placement.preview.reason}</p>
            {placement.preview.kind === 'READY' ? (
              <button type="button" onClick={() => void applyPlacement()} disabled={locked || busy}>
                Aplicar encaixe F3
              </button>
            ) : null}
          </div>
        ) : null}
        <p className="hint">A dispensa de um aviso não cancela nem conclui o compromisso.</p>
      </article>

      <article className="session-card" data-testid="review-weak-points">
        <h3>Pontos fracos e retenção</h3>
        {weakPoints.length === 0 ? (
          <p className="hint">Nenhum tópico com evidência.</p>
        ) : (
          <ul>
            {weakPoints.map((item) => (
              <li key={item.canonicalTopicKey} data-status={item.status}>
                {item.label} · {weakStatusLabel(item.status)} · {item.correctAnswers}/{item.questions}{' '}
                acertos · retenção esqueci {item.retention.forgot}, parcial {item.retention.partial},{' '}
                boa {item.retention.good} · tendência {trendLabel(item.trend)}
                {item.conflicts.length > 0
                  ? ` · ${item.conflicts.length} conflito(s) F4 preservado(s)`
                  : ''}
                <p className="hint">
                  Fontes: {item.evidence.length} evidência(s) F4/F5; status da projeção preservado.
                </p>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="session-card" data-testid="review-projections">
        <h3>Cache de pontos fracos</h3>
        <p className="hint">
          Cache regenerável que acompanha os fatos de estudo. Quando algo muda, o cache é
          marcado como desatualizado e os pontos fracos voltam a ser calculados sob demanda.
        </p>
        <p className="session-status" data-testid="projection-status" aria-live="polite">
          {projectionStatus?.kind === 'READY'
            ? `Atual · ${projectionStatus.rows} linha(s) · gerado em ${formatInstant(projectionStatus.projection?.generatedAt)}`
            : projectionStatus?.kind === 'STALE'
              ? `Desatualizado porque ${projectionReasonLabel(projectionStatus.reason)} · reconstrua para atualizar`
              : 'Ainda não gerado · os pontos fracos são calculados sob demanda'}
        </p>
        <button type="button" onClick={() => void rebuildProjection()} disabled={locked || busy}>
          Reconstruir cache
        </button>
      </article>

      <article className="session-card" data-testid="review-board">
        <h3>Inteligência de banca</h3>
        <div className="session-grid">
          <label>
            Título/fonte
            <input value={boardTitle} onChange={(event) => setBoardTitle(event.target.value)} />
          </label>
          <label>
            Amostra (opcional)
            <input type="number" min={0} value={boardSample} onChange={(event) => setBoardSample(event.target.value)} />
          </label>
          <label>
            Denominador (opcional)
            <input type="number" min={0} value={boardDenominator} onChange={(event) => setBoardDenominator(event.target.value)} />
          </label>
        </div>
        <label>
          Texto da evidência
          <textarea rows={4} value={boardText} onChange={(event) => setBoardText(event.target.value)} />
        </label>
        <div className="session-actions">
          <button type="button" onClick={() => void importBoard()} disabled={locked || busy}>
            Importar fonte
          </button>
        </div>
        {boardEvidence.map((evidence) => (
          <div key={evidence.id}>
            <p className="hint">
              {evidence.title} · {evidence.kind}
              {evidence.sampleSize !== undefined ? ` · ${evidence.sampleSize}/${evidence.denominator ?? '?'}` : ''}
            </p>
            {(boardMatches[evidence.id]?.candidates ?? []).map((candidate) => (
              <button
                key={candidate.topic.id}
                type="button"
                onClick={() => void confirmMatch(evidence.id, candidate)}
                disabled={locked || busy}
              >
                Confirmar {candidate.topic.label} ({matchReasonLabel(candidate.reason)})
              </button>
            ))}
            {boardMatches[evidence.id]?.ambiguous ? (
              <p className="hint">Correspondência ambígua; confirme o contexto do edital.</p>
            ) : null}
          </div>
        ))}
      </article>

      <article className="session-card" data-testid="review-priorities">
        <h3>Prioridade contextual</h3>
        <div className="session-actions">
          <select value={selectedEditalId} onChange={(event) => setSelectedEditalId(event.target.value)}>
            <option value="">Edital</option>
            {editais.map((edital) => (
              <option key={edital.id} value={edital.id}>{edital.title}</option>
            ))}
          </select>
          <button type="button" onClick={() => void updatePriority()} disabled={locked || busy || !selectedEditalId}>
            Recalcular prioridade
          </button>
        </div>
        {priority ? (
          <ol>
            {priority.rows.map((row) => (
              <li key={row.canonicalTopicKey} data-insufficient={row.insufficient}>
                {row.label} · score {row.score} · {row.explanation}
                {row.insufficient ? ' · evidência insuficiente' : ''}
              </li>
            ))}
          </ol>
        ) : (
          <p className="hint">Escolha um edital para explicar a prioridade.</p>
        )}
      </article>

      <article className="session-card" data-testid="review-reminders">
        <h3>Lembretes e avisos</h3>
        <p className="hint">
          A central local funciona offline. Avisos externos são opcionais, exigem permissão
          e, nesta fatia, são enviados apenas manualmente pelo botão de teste enquanto o app
          está aberto. Não há promessa de disparo com o PWA fechado.
        </p>
        <div className="session-grid">
          <label>
            <input
              type="checkbox"
              checked={externalEnabled}
              onChange={(event) => setExternalEnabled(event.target.checked)}
            />
            Permitir aviso externo uma vez por lembrete
          </label>
          <label>
            Silêncio começa
            <input
              type="time"
              value={quietStart}
              onChange={(event) => setQuietStart(event.target.value)}
            />
          </label>
          <label>
            Silêncio termina
            <input
              type="time"
              value={quietEnd}
              onChange={(event) => setQuietEnd(event.target.value)}
            />
          </label>
        </div>
        <div className="session-actions">
          <button type="button" onClick={() => void saveReminderPreferences()} disabled={locked || busy}>
            Gravar preferências
          </button>
          <button
            type="button"
            onClick={() => void requestNotifications()}
            disabled={locked || busy || notificationPermission === 'UNSUPPORTED'}
          >
            Autorizar avisos externos
          </button>
          <button
            type="button"
            onClick={() => void testExternalNotification()}
            disabled={locked || busy || notificationPermission !== 'granted'}
          >
            Testar aviso externo
          </button>
        </div>
        <p className="hint" data-testid="notification-permission" aria-live="polite">
          Permissão: {notificationPermission === 'UNSUPPORTED'
            ? 'não suportada neste navegador'
            : notificationPermission === 'granted'
              ? 'concedida'
              : notificationPermission === 'denied'
                ? 'negada'
                : 'ainda não solicitada'}.
          {reminders?.quietActive ? ' Horário de silêncio ativo para avisos externos.' : ''}
        </p>
        {reminderItems.length === 0 ? (
          <p className="hint">Nenhum lembrete pendente no horizonte de 14 dias.</p>
        ) : (
          <ul>
            {reminderItems.map(({ commitment, label }) => {
              const dismissed = reminders?.dismissedIds.includes(commitment.id) ?? false;
              return (
                <li
                  key={commitment.id}
                  data-dismissed={dismissed}
                  data-entity-id={commitment.id}
                >
                  {commitment.label} · {label} · vence {commitment.currentDueDate}
                  {dismissed ? ' · aviso dispensado' : ''}
                  <button
                    type="button"
                    onClick={() => void dismissReminder(commitment)}
                    disabled={locked || busy || dismissed}
                    aria-label={`Dispensar aviso de ${commitment.label}`}
                  >
                    Dispensar aviso
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </article>

      <article className="session-card" data-testid="review-portability">
        <h3>Portabilidade e lembretes</h3>
        <p className="hint">
          Avisos externos são opcionais e nunca prometem disparo com o app fechado.
        </p>
        <div className="session-actions">
          <button type="button" onClick={() => void exportData()} disabled={locked || busy}>
            Exportar JSON acadêmico
          </button>
          <button type="button" onClick={() => void exportCsv()} disabled={locked || busy}>
            Exportar CSV
          </button>
          <label>
            Importar JSON
            <input
              type="file"
              accept="application/json"
              onChange={(event) => void selectImportFile(event.target.files?.[0])}
            />
          </label>
        </div>
        {importPreview ? (
          <div>
            <p className="hint">
              {importPreview.kind === 'READY'
                ? `Prévia: ${Object.entries(importPreview.counts).map(([key, value]) => `${key} ${value}`).join(', ')}`
                : importPreview.kind === 'CONFLICT'
                  ? `Conflito: ${importPreview.reason}`
                  : `Inválido: ${importPreview.reason}`}
            </p>
            {importPreview.kind === 'READY' ? (
              <button type="button" onClick={() => void applyImport()} disabled={locked || busy}>
                Aplicar importação
              </button>
            ) : null}
          </div>
        ) : null}
        <p className="hint">
          {reminders?.overdue.length ?? 0} atrasada(s), {reminders?.dueToday.length ?? 0} hoje,{' '}
          {reminders?.upcoming.length ?? 0} próxima(s).
        </p>
      </article>
    </section>
  );
}
