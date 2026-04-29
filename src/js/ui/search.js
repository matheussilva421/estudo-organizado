/**
 * Global Search
 * UX 1 — Global search with debounced input, results highlighting, keyboard navigation
 */

import { state } from '../store.js?v=8.29';
import { esc, formatDate, HABIT_TYPES, addCleanupListener } from '../utils.js?v=8.29';
import { getAllDisciplinas, getDisc } from '../logic.js?v=8.29';
import { closeModal } from '../app.js?v=8.29';

export let searchBlurTimeout = null;

let _searchDebounceTimer = null;
export function debouncedOnSearch(query) {
  if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
  _searchDebounceTimer = setTimeout(() => {
    onSearch(query);
  }, 300);
}

export function onSearch(query) {
  const box = document.getElementById('search-results');
  const input = document.getElementById('global-search');
  if (!box || !input) return;

  if (!query || query.length < 2) {
    box.classList.remove('open');
    input.setAttribute('aria-expanded', 'false');
    return;
  }

  const q = query.toLowerCase();
  const results = { eventos: [], disciplinas: [], assuntos: [], habitos: [] };

  // Search eventos
  state.eventos.forEach((ev) => {
    if (ev.titulo.toLowerCase().includes(q)) {
      const disc = ev.discId ? getDisc(ev.discId)?.disc : null;
      results.eventos.push({ ev, disc });
    }
  });

  // Search disciplinas (deduplicated by id)
  const seenDiscIds = new Set();
  getAllDisciplinas().forEach(({ disc, edital }) => {
    if (disc.nome.toLowerCase().includes(q) && !seenDiscIds.has(disc.id)) {
      seenDiscIds.add(disc.id);
      results.disciplinas.push({ disc, edital });
    }
    // Search assuntos
    (disc.assuntos || []).forEach((ass) => {
      if (ass.nome.toLowerCase().includes(q) || disc.nome.toLowerCase().includes(q)) {
        results.assuntos.push({ ass, disc, edital });
      }
    });
  });

  // Search hábitos
  HABIT_TYPES.forEach((h) => {
    (state.habitos[h.key] || []).forEach((r) => {
      if ((r.descricao || '').toLowerCase().includes(q)) {
        results.habitos.push({ r, h });
      }
    });
  });

  const totalResults =
    results.eventos.length +
    results.disciplinas.length +
    results.assuntos.length +
    results.habitos.length;

  // Announce results to screen readers
  const announcer = document.getElementById('aria-announcer');
  if (announcer) {
    announcer.textContent = `${totalResults} resultado(s) encontrado(s)`;
  }

  const highlight = (str) =>
    esc(str).replace(
      new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
      '<mark>$1</mark>'
    );
  let html = '';

  if (results.eventos.length) {
    html += '<div class="search-section-title" role="presentation">📅 Eventos</div>';
    html += results.eventos
      .slice(0, 5)
      .map(
        ({ ev, disc }) => `
      <button type="button" class="search-item" data-action="open-search-event" data-event-id="${ev.id}">
        <div class="search-item-icon">${disc ? disc.icone || '📚' : '📅'}</div>
        <div>
          <div class="search-item-label">${highlight(ev.titulo)}</div>
          <div class="search-item-sub">${ev.data ? formatDate(ev.data) : ''}${disc ? ' • ' + disc.nome : ''}</div>
        </div>
      </button>`
      )
      .join('');
  }

  if (results.disciplinas.length) {
    html += '<div class="search-section-title" role="presentation">📖 Disciplinas</div>';
    html += results.disciplinas
      .slice(0, 5)
      .map(
        ({ disc, edital }) => `
      <button type="button" class="search-item" data-action="navigate-clear-search" data-view="editais">
        <div class="search-item-icon">${disc.icone || '📖'}</div>
        <div>
          <div class="search-item-label">${highlight(disc.nome)}</div>
          <div class="search-item-sub">${esc(edital.nome)} • ${(disc.assuntos || []).length} assunto(s)</div>
        </div>
      </button>`
      )
      .join('');
  }

  if (results.assuntos.length) {
    html += '<div class="search-section-title" role="presentation">📚 Assuntos</div>';
    html += results.assuntos
      .slice(0, 5)
      .map(
        ({ ass, disc, edital }) => `
      <button type="button" class="search-item" data-action="navigate-clear-search" data-view="editais">
        <div class="search-item-icon">${disc.icone || '📚'}</div>
        <div>
          <div class="search-item-label">${highlight(ass.nome)}</div>
          <div class="search-item-sub">${esc(disc.nome)} • ${esc(edital.nome)} ${ass.concluido ? '✅' : ''}</div>
        </div>
      </button>`
      )
      .join('');
  }

  if (results.habitos.length) {
    html += '<div class="search-section-title" role="presentation">⚡ Hábitos</div>';
    html += results.habitos
      .slice(0, 3)
      .map(
        ({ r, h }) => `
      <button type="button" class="search-item" data-action="navigate-clear-search" data-view="habitos">
        <div class="search-item-icon">${h.icon}</div>
        <div>
          <div class="search-item-label">${highlight(r.descricao || h.label)}</div>
          <div class="search-item-sub">${formatDate(r.data)}</div>
        </div>
      </button>`
      )
      .join('');
  }

  if (!html)
    html = `<div class="search-empty">Nenhum resultado para "<strong>${query}</strong>"</div>`;
  box.innerHTML = html;
  box.classList.add('open');
  input.setAttribute('aria-expanded', 'true');
}

export function onSearchFocus() {
  clearTimeout(searchBlurTimeout);
  const input = document.getElementById('global-search');
  const val = input?.value || '';
  if (val && val.length >= 2) {
    onSearch(val);
  }
}

export function onSearchBlur() {
  searchBlurTimeout = setTimeout(() => {
    document.getElementById('search-results')?.classList.remove('open');
    document.getElementById('global-search')?.setAttribute('aria-expanded', 'false');
  }, 200);
}

export function clearSearch() {
  const input = document.getElementById('global-search');
  const results = document.getElementById('search-results');
  if (input) {
    input.value = '';
    input.setAttribute('aria-expanded', 'false');
  }
  results?.classList.remove('open');
}

function handleSearchKeydown(e) {
  const input = document.getElementById('global-search');
  const results = document.getElementById('search-results');
  if (!input || !results || !results.classList.contains('open')) return false;

  const active = document.activeElement;
  const isInsideSearch = active === input || results.contains(active);
  if (!isInsideSearch) return false;

  if (e.key === 'Escape') {
    e.preventDefault();
    clearSearch();
    input.focus();
    return true;
  }

  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return false;

  const buttons = [...results.querySelectorAll('button.search-item')];
  if (buttons.length === 0) return false;

  e.preventDefault();
  const currentIndex = buttons.indexOf(active);
  const nextIndex =
    e.key === 'ArrowDown'
      ? (currentIndex + 1) % buttons.length
      : currentIndex <= 0
        ? buttons.length - 1
        : currentIndex - 1;

  buttons[nextIndex].focus();
  return true;
}

// ESC closes search / topmost modal
addCleanupListener(document, 'keydown', (e) => {
  if (handleSearchKeydown(e)) return;
  if (e.key === 'Escape') {
    const openModals = [...document.querySelectorAll('.modal-overlay.open')];
    if (openModals.length > 0) {
      const top = openModals[openModals.length - 1];
      if (top.id === 'modal-confirm') {
        // cancel callback handled by app.js
      }
      closeModal(top.id);
    } else {
      clearSearch();
    }
  }

  // Enter submits the active modal form (not inside textarea)
  if (
    e.key === 'Enter' &&
    !e.shiftKey &&
    e.target.tagName !== 'TEXTAREA' &&
    e.target.tagName !== 'SELECT'
  ) {
    const openModalEl = document.querySelector(
      '.modal-overlay.open:not(#modal-confirm):not(#modal-event-detail)'
    );
    if (openModalEl) {
      const saveBtn = openModalEl.querySelector(
        'button[onclick*="save"], button[onclick*="Save"], button.btn-primary'
      );
      if (saveBtn && !saveBtn.disabled) {
        e.preventDefault();
        saveBtn.click();
      }
    }
  }
});
