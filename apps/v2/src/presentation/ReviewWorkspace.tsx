import { useCallback, useEffect, useMemo, useState } from 'react';
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
  ReviewSuggestion,
  ReviewTopicLink,
  WeakPointProjection,
} from '../domain/review';
type Props = {
  profileId: string;
  content: ContentSnapshot;
  locked: boolean;
  onNotice: (message: string | null) => void;
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

export function ReviewWorkspace({ profileId, content, locked, onNotice }: Props) {
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

  const editais = content.editais.filter((edital) => edital.status === 'ACTIVE');
  const disciplines = content.links.filter(
    (link) => link.editalId === selectedEditalId && link.status === 'ACTIVE',
  );
  const assuntos = content.assuntos.filter(
    (assunto) => assunto.editalDisciplineId === selectedDisciplineId,
  );

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
      onNotice('Duração padrão deve ficar entre 5 e 180 minutos.');
      return;
    }
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
      await service.savePriority(profileId, next, newId());
      onNotice('Prioridade contextual explicada e versionada.');
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
              <li key={topic.id}>{topic.label}</li>
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
              <li key={commitment.id}>
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
                {item.conflicts.length > 0 ? ` · conflito: ${item.conflicts.join(', ')}` : ''}
                <p className="hint">Evidências: {item.evidence.join(' · ') || 'nenhuma'}</p>
              </li>
            ))}
          </ul>
        )}
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
                Confirmar {candidate.topic.label} ({candidate.reason})
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
