/* GCV V9 — controles compartilhados, conteúdo local e nenhuma dependência externa. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const compactNav = matchMedia('(max-width: 1100px)');
  const ui = {
    status: $('#interaction-status'), menu: $('#menu-button'), sidebar: $('#site-sidebar'),
    navToggle: $('#nav-toggle'), backdrop: $('#menu-backdrop'), motion: $('#motion-toggle'),
    collapseAll: $('#collapse-all'), print: $('#print-button'), progress: $('#page-progress'),
    search: $('#search-dialog'), input: $('#search-input'), results: $('#search-results'),
    searchStatus: $('#search-status'), searchOpen: $('#search-open')
  };
  const state = { paused: reducedMotion.matches, desktopMenu: true, scrollQueued: false, printing: false, printSnapshot: null, searchTrigger: null };
  const announce = text => { ui.status.textContent = text; };
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const navLinks = $$('#main-nav a');
  const navBlocks = $$('#main-nav .nav-block');
  const sections = $$('.section[data-label]');
  const readingStops = $$('.section[data-label], .gcv-block-divider');
  const collapses = $$('[data-collapse]').map(button => ({
    button, panel: document.getElementById(button.getAttribute('aria-controls')),
    root: button.closest(button.dataset.collapse === 'block' ? '.gcv-block-divider' : '.section'),
    kind: button.dataset.collapseLabel || (button.dataset.collapse === 'block' ? 'bloco' : 'tópico')
  }));
  const blockTopics = collapses.filter(item => item.button.dataset.collapse !== 'section');

  function enter(panel) {
    if (state.paused) return;
    panel.classList.remove('revealing');
    requestAnimationFrame(() => panel.classList.add('revealing'));
  }

  // Leitura: os blocos preservam a seleção individual de seus tópicos.
  function setExpanded(item, expanded) {
    const { button, panel, root, kind } = item;
    if (!expanded && panel.contains(document.activeElement)) button.focus({ preventScroll: true });
    panel.hidden = !expanded;
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', `${expanded ? 'Recolher' : 'Expandir'} ${button.dataset.collapseContext}`);
    $('.collapse-label', button).textContent = `${expanded ? 'Recolher' : 'Expandir'} ${kind}`;
    $('.collapse-icon', button).textContent = expanded ? '−' : '+';
    root.classList.toggle(button.dataset.collapse === 'section' ? 'is-section-collapsed' : 'is-collapsed', !expanded);
  }

  function syncCollapseAll() {
    const expanded = blockTopics.every(item => !item.panel.hidden);
    ui.collapseAll.setAttribute('aria-expanded', String(expanded));
    ui.collapseAll.setAttribute('aria-label', `${expanded ? 'Recolher' : 'Expandir'} todos os blocos e tópicos`);
    ui.collapseAll.textContent = `${expanded ? 'Recolher' : 'Expandir'} Blocos/Tópicos`;
  }

  function revealDestination(target) {
    if (!target) return;
    collapses.forEach(item => {
      if (item.root === target || item.panel === target || item.panel.contains(target)) setExpanded(item, true);
    });
    for (let node = target; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
      if (node.matches('[role="tabpanel"][hidden]')) document.querySelector(`[role="tab"][aria-controls="${node.id}"]`)?.click();
      if (node.classList.contains('reveal-ready')) node.classList.add('has-entered');
    }
    $$('.reveal-ready', target).forEach(node => node.classList.add('has-entered'));
    syncCollapseAll();
    queueScroll();
  }

  function revealHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    revealDestination(target);
    requestAnimationFrame(() => { target.scrollIntoView({ block: 'start', behavior: 'instant' }); queueScroll(); });
  }

  function initCollapse() {
    collapses.forEach(item => {
      item.button.hidden = false;
      item.button.addEventListener('click', () => {
        const expanded = item.panel.hidden;
        setExpanded(item, expanded);
        syncCollapseAll();
        queueScroll();
        announce(`${item.button.dataset.collapseContext}: ${expanded ? 'expandido' : 'recolhido'}.`);
      });
    });
    ui.collapseAll.hidden = false;
    ui.collapseAll.addEventListener('click', () => {
      const expanded = blockTopics.some(item => item.panel.hidden);
      blockTopics.forEach(item => setExpanded(item, expanded));
      syncCollapseAll();
      queueScroll();
      announce(`Todos os blocos e tópicos foram ${expanded ? 'expandidos' : 'recolhidos'}.`);
    });
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link?.hash) return;
      try { revealDestination(document.getElementById(decodeURIComponent(link.hash.slice(1)))); } catch { /* Âncora malformada não interrompe os demais controles. */ }
    }, true);
    window.addEventListener('hashchange', revealHash);
    syncCollapseAll();
    requestAnimationFrame(revealHash);
  }

  // Uma implementação de abas atende ciclo, categorias, decisão e modelagens.
  function initTabs() {
    $$('[role="tablist"]').forEach(group => {
      const tabs = $$('[role="tab"]', group);
      const select = (tab, focus = false) => {
        tabs.forEach(item => {
          const selected = item === tab;
          item.setAttribute('aria-selected', String(selected));
          item.tabIndex = selected ? 0 : -1;
          const panel = document.getElementById(item.getAttribute('aria-controls'));
          panel.hidden = !selected;
          if (selected) enter(panel);
        });
        if (focus) tab.focus();
        announce(tab.textContent.trim());
        queueScroll();
      };
      group.addEventListener('click', event => {
        const tab = event.target.closest('[role="tab"]');
        if (tabs.includes(tab)) select(tab);
      });
      group.addEventListener('keydown', event => {
        const index = tabs.indexOf(event.target.closest('[role="tab"]'));
        if (index < 0) return;
        const next = { ArrowRight: (index + 1) % tabs.length, ArrowDown: (index + 1) % tabs.length,
          ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowUp: (index + tabs.length - 1) % tabs.length,
          Home: 0, End: tabs.length - 1 }[event.key];
        if (next !== undefined) { event.preventDefault(); select(tabs[next], true); }
      });
    });
  }

  function initGcvDiagrams() {
    $$('[data-life-link]').forEach(link => link.addEventListener('click', () => document.getElementById(`life-tab-${link.dataset.lifeLink}`)?.click()));
    const demandButtons = $$('[data-demand]');
    const demandPanels = $$('[data-demand-panel]');
    demandButtons.forEach(button => button.addEventListener('click', () => {
      demandButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      demandPanels.forEach(panel => { panel.hidden = panel.dataset.demandPanel !== button.dataset.demand; if (!panel.hidden) enter(panel); });
      $('#flow-destination').hidden = button.dataset.demand === '3';
      announce(`Rota ${button.dataset.demand}. ${$('strong', button).textContent}`);
      queueScroll();
    }));
    const systemButtons = $$('[data-system]');
    const systemPanels = $$('[data-system-panel]');
    systemButtons.forEach(button => button.addEventListener('click', () => {
      systemButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      systemPanels.forEach(panel => panel.hidden = panel.dataset.systemPanel !== button.dataset.system);
      $('#system-index').textContent = String(Number(button.dataset.system) + 1).padStart(2, '0');
      enter($('.system-detail'));
      announce($('h3', document.getElementById(button.getAttribute('aria-controls'))).textContent);
      queueScroll();
    }));
    $('#phase-order').addEventListener('change', event => {
      const reverse = event.target.checked;
      $('#competition-first').textContent = reverse ? 'Habilitação' : 'Julgamento';
      $('#competition-second').textContent = reverse ? 'Julgamento' : 'Habilitação';
      $('#competition-first').nextElementSibling.textContent = reverse ? 'Verificação das condições de participação.' : 'Avaliação das propostas.';
      $('#competition-second').nextElementSibling.textContent = reverse ? 'Avaliação das propostas.' : 'Verificação das condições de participação.';
      enter($('#competition-steps'));
      announce(reverse ? 'Com inversão: habilitação, julgamento, adjudicação e homologação.' : 'Sem inversão: julgamento, habilitação, adjudicação e homologação.');
    });
  }

  function syncMotion() {
    document.documentElement.classList.toggle('motion-paused', state.paused);
    ui.motion.setAttribute('aria-pressed', String(state.paused));
    ui.motion.textContent = state.paused ? 'Ativar animações' : 'Pausar animações';
    if (state.paused) $$('.reveal-ready').forEach(item => item.classList.add('has-entered'));
  }

  function initMotion() {
    ui.motion.addEventListener('click', () => { state.paused = !state.paused; syncMotion(); });
    reducedMotion.addEventListener('change', () => { state.paused = reducedMotion.matches; syncMotion(); });
    syncMotion();
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('has-entered'); observer.unobserve(entry.target); }
    }), { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    for (const [selector, type] of [['.chapter > .wrap', 'gcv-topic-reveal'], ['.gcv-block-divider > .wrap', 'gcv-block-reveal']]) {
      $$(selector).forEach(item => {
        item.classList.add('reveal-ready', type);
        if (state.paused) item.classList.add('has-entered');
        observer.observe(item);
      });
    }
  }

  function setMenu(open) {
    if (!compactNav.matches) state.desktopMenu = open;
    ui.sidebar.classList.toggle('open', open);
    ui.sidebar.inert = !open;
    ui.sidebar.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('sidebar-collapsed', !compactNav.matches && !open);
    document.body.classList.toggle('menu-open', compactNav.matches && open);
    ui.backdrop.hidden = !compactNav.matches || !open;
    const action = open ? 'Recolher Menu Lateral' : 'Exibir Menu Lateral';
    [ui.menu, ui.navToggle].forEach(button => { button.setAttribute('aria-expanded', String(open)); button.setAttribute('aria-label', action); button.title = action; });
    $('.menu-label', ui.menu).textContent = action;
    $('.nav-toggle-icon', ui.navToggle).textContent = open ? '−' : '+';
    if (!open && ui.sidebar.contains(document.activeElement)) ui.menu.focus({ preventScroll: true });
  }

  function closeMenu() { if (compactNav.matches) setMenu(false); }

  function initMenu() {
    const toggle = () => { const open = ui.menu.getAttribute('aria-expanded') !== 'true'; setMenu(open); announce(`Barra lateral ${open ? 'exibida' : 'recolhida'}.`); };
    ui.menu.addEventListener('click', toggle);
    ui.navToggle.addEventListener('click', toggle);
    ui.backdrop.addEventListener('click', () => { closeMenu(); ui.menu.focus(); });
    [...navLinks, $('.sidebar-brand')].forEach(link => link.addEventListener('click', () => {
      const target = document.getElementById(link.hash.slice(1));
      if (compactNav.matches) { closeMenu(); if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); } }
    }));
    document.addEventListener('keydown', event => {
      if (!compactNav.matches || ui.sidebar.inert) return;
      if (event.key === 'Escape') { closeMenu(); ui.menu.focus(); }
      if (event.key !== 'Tab') return;
      const nodes = [...$$('a,button', ui.sidebar), ui.menu].filter(node => node.getClientRects().length && !node.disabled);
      const next = (nodes.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
      event.preventDefault(); nodes[next].focus();
    });
    compactNav.addEventListener('change', () => setMenu(compactNav.matches ? false : state.desktopMenu));
    setMenu(!compactNav.matches);
  }

  function updateScroll() {
    const available = document.documentElement.scrollHeight - innerHeight;
    ui.progress.style.width = `${available > 0 ? Math.max(0, Math.min(100, scrollY / available * 100)) : 0}%`;
    const offset = $('.header').offsetHeight + 100;
    let active = 'inicio';
    readingStops.forEach(section => { if (section.getClientRects().length && section.getBoundingClientRect().top < offset) active = section.id; });
    const block = document.getElementById(active)?.dataset.block;
    navBlocks.forEach(group => group.classList.toggle('is-current', group.dataset.block === block));
    navLinks.forEach(link => {
      const selected = link.hash === `#${active}`;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
    state.scrollQueued = false;
  }

  function queueScroll() {
    if (state.scrollQueued) return;
    state.scrollQueued = true;
    requestAnimationFrame(updateScroll);
  }

  function initSearch() {
    const index = sections.map(section => ({ id: section.id, number: section.dataset.number,
      label: section.dataset.label, title: $('h1,h2', section).textContent.replace(/\s+/g, ' ').trim(), text: normalize(section.textContent) }));
    const render = () => {
      const words = normalize(ui.input.value).trim().split(/\s+/).filter(Boolean);
      const found = index.filter(section => words.every(word => section.text.includes(word)));
      ui.searchStatus.textContent = words.length ? `${found.length} ${found.length === 1 ? 'assunto encontrado' : 'assuntos encontrados'}.` : 'Escolha um tema ou digite um termo para filtrar.';
      const fragment = document.createDocumentFragment();
      found.forEach(section => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'search-result'; button.dataset.destination = section.id;
        const number = document.createElement('span'); number.textContent = section.number;
        const content = document.createElement('span');
        const label = document.createElement('strong'); label.textContent = section.label;
        const title = document.createElement('small'); title.textContent = section.title;
        content.append(label, title); button.append(number, content); fragment.append(button);
      });
      ui.results.replaceChildren(fragment);
    };
    const open = () => { state.searchTrigger = document.activeElement; closeMenu(); ui.search.showModal(); document.body.classList.add('modal-open'); render(); ui.input.focus(); };
    ui.searchOpen.addEventListener('click', open);
    $('#search-close').addEventListener('click', () => ui.search.close());
    ui.input.addEventListener('input', render);
    ui.results.addEventListener('click', event => {
      const result = event.target.closest('[data-destination]');
      if (!result) return;
      const target = document.getElementById(result.dataset.destination);
      revealDestination(target); ui.search.close(); location.hash = target.id;
      target.scrollIntoView({ behavior: state.paused ? 'auto' : 'smooth', block: 'start' });
      const heading = $('h1,h2', target); heading.tabIndex = -1; heading.focus({ preventScroll: true });
      target.classList.remove('section-highlight'); requestAnimationFrame(() => target.classList.add('section-highlight'));
    });
    ui.search.addEventListener('close', () => { document.body.classList.remove('modal-open'); if (state.searchTrigger?.isConnected) state.searchTrigger.focus({ preventScroll: true }); });
    ui.search.addEventListener('click', event => {
      if (event.target !== ui.search) return;
      const box = ui.search.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) ui.search.close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.matches('input,textarea,select,[contenteditable="true"]') && !ui.search.open) { event.preventDefault(); open(); }
    });
  }

  function initPrint() {
    window.addEventListener('beforeprint', () => {
      if (state.printing) return;
      state.printing = true;
      state.printSnapshot = { collapses: collapses.map(item => !item.panel.hidden), details: $$('details').map(item => [item, item.open]) };
      collapses.forEach(item => setExpanded(item, true));
      state.printSnapshot.details.forEach(([item]) => item.open = true);
      syncCollapseAll();
    });
    window.addEventListener('afterprint', () => {
      if (!state.printSnapshot) return;
      collapses.forEach((item, index) => setExpanded(item, state.printSnapshot.collapses[index]));
      state.printSnapshot.details.forEach(([item, open]) => item.open = open);
      state.printSnapshot = null; state.printing = false;
      syncCollapseAll(); queueScroll();
    });
    ui.print.addEventListener('click', async () => {
      if (ui.print.disabled) return;
      ui.print.disabled = true; ui.print.textContent = 'Preparando…';
      try {
        await Promise.all($$('img').map(async image => { image.loading = 'eager'; if (image.decode) await image.decode().catch(() => {}); }));
        await new Promise(resolve => requestAnimationFrame(resolve));
        window.print();
      } finally { ui.print.disabled = false; ui.print.textContent = 'Imprimir'; }
    });
  }

  initTabs();
  initGcvDiagrams();
  initCollapse();
  initMenu();
  initSearch();
  initPrint();
  initMotion();
  window.addEventListener('scroll', queueScroll, { passive: true });
  window.addEventListener('resize', queueScroll);
  window.addEventListener('load', queueScroll);
  if ('ResizeObserver' in window) new ResizeObserver(queueScroll).observe($('#conteudo'));
  updateScroll();
})();
