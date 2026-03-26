const tbody = document.getElementById("tbody");
const form = document.getElementById("form-org");
const formMsg = document.getElementById("form-msg");
const detailPanel = document.getElementById("detail-panel");
const detailMain = document.getElementById("detail-main");
const detailBanner = document.getElementById("detail-banner");
const detailSummary = document.getElementById("detail-summary");
const detailJsonDetails = document.getElementById("detail-json-details");
const detailJson = document.getElementById("detail-json");
const btnCopyJson = document.getElementById("btn-copy-json");
const btnRefresh = document.getElementById("btn-refresh");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const pageInfo = document.getElementById("page-info");
const paginationEl = document.getElementById("pagination");

const LIST_LIMIT = 15;
let listOffset = 0;
let lastListLength = 0;
let listTotal = 0;

let selectedId = null;
let pollTimer = null;

function shortId(uuid) {
  return uuid ? `${uuid.slice(0, 8)}…` : "—";
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

async function fetchListPage() {
  const params = new URLSearchParams({
    limit: String(LIST_LIMIT),
    offset: String(listOffset),
  });
  const res = await fetch(`/api/requests?${params}`);
  if (!res.ok) throw new Error(`Lista: HTTP ${res.status}`);
  return res.json();
}

async function fetchOne(id) {
  const res = await fetch(`/api/requests/${id}`);
  if (!res.ok) throw new Error(`Detalhe: HTTP ${res.status}`);
  return res.json();
}

function updatePaginationControls() {
  if (!btnPrev || !btnNext || !pageInfo) return;
  const hideBar = listOffset === 0 && lastListLength === 0 && listTotal === 0;
  if (paginationEl) paginationEl.classList.toggle("hidden", hideBar);
  if (hideBar) return;

  btnPrev.disabled = listOffset === 0;
  btnNext.disabled = listOffset + lastListLength >= listTotal;
  if (lastListLength === 0) {
    pageInfo.textContent = "Nenhum pedido nesta página — volte uma página.";
    return;
  }
  const from = listOffset + 1;
  const to = listOffset + lastListLength;
  pageInfo.textContent = `Itens ${from}–${to} de ${listTotal}`;
}

async function deleteRequestById(id) {
  if (
    !confirm(
      "Apagar este pedido? O registro no PostgreSQL e o snapshot no Mongo (se existir) serão removidos.",
    )
  ) {
    return;
  }
  try {
    const res = await fetch(`/api/requests/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.status === 404) {
      alert("Pedido não encontrado.");
      await refreshList();
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error?.message ?? `Erro HTTP ${res.status}`);
      return;
    }
    if (selectedId === id) clearDetail();
    await refreshList();
  } catch (e) {
    alert(String(e));
  }
}

function renderRows(items) {
  tbody.innerHTML = "";
  if (items.length === 0) {
    const tr = document.createElement("tr");
    tr.className = "empty-state";
    tr.innerHTML =
      '<td colspan="5">Nenhum pedido ainda. Envie uma organização acima.</td>';
    tbody.appendChild(tr);
    return;
  }
  for (const r of items) {
    const tr = document.createElement("tr");
    tr.dataset.id = r.id;
    if (r.id === selectedId) tr.classList.add("selected");
    tr.innerHTML = `
      <td><strong>${escapeHtml(r.organizationName)}</strong></td>
      <td class="status-${r.status}">${escapeHtml(r.status)}</td>
      <td><code>${escapeHtml(shortId(r.id))}</code></td>
      <td>${escapeHtml(fmtDate(r.createdAt))}</td>
      <td class="col-actions">
        <button type="button" class="btn-delete" title="Apagar pedido" aria-label="Apagar pedido">🗑</button>
      </td>
    `;
    tr.addEventListener("click", () => selectRow(r.id));
    tr.querySelector(".btn-delete").addEventListener("click", (ev) => {
      ev.stopPropagation();
      void deleteRequestById(r.id);
    });
    tbody.appendChild(tr);
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

const COPY_JSON_LABEL = "Copiar JSON";

function resetJsonCopyButton() {
  if (!btnCopyJson) return;
  btnCopyJson.classList.remove("copied");
  btnCopyJson.setAttribute("title", COPY_JSON_LABEL);
  btnCopyJson.setAttribute("aria-label", COPY_JSON_LABEL);
}

function syncDetailCopyButton() {
  if (!btnCopyJson) return;
  const hasJson = Boolean(detailJson?.textContent?.trim());
  const blockVisible =
    detailJsonDetails && !detailJsonDetails.classList.contains("hidden");
  const show = hasJson && blockVisible;
  btnCopyJson.classList.toggle("hidden", !show);
  btnCopyJson.disabled = !show;
}

btnCopyJson?.addEventListener("mousedown", (e) => {
  e.stopPropagation();
});

btnCopyJson?.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const text = detailJson?.textContent ?? "";
  if (!text.trim()) return;
  try {
    await navigator.clipboard.writeText(text);
    btnCopyJson.classList.add("copied");
    btnCopyJson.setAttribute("title", "Copiado!");
    btnCopyJson.setAttribute("aria-label", "Copiado!");
    setTimeout(() => resetJsonCopyButton(), 1600);
  } catch {
    alert(
      "Não foi possível copiar (permissão da área de transferência). Copie manualmente do bloco JSON.",
    );
  }
});

/** @param {Record<string, unknown>} data */
function buildOrgCardHtml(data) {
  const d = data.result?.data;
  const meta = data.result?.metadata;
  const req = data.request;
  if (!d) return "";
  const login = d.login || req?.organizationName || "";
  const nf = new Intl.NumberFormat("pt-BR");
  const repos =
    d.stats?.repositories != null ? nf.format(d.stats.repositories) : "—";
  const people =
    d.stats?.people != null ? nf.format(d.stats.people) : "—";

  const avatar =
    d.avatarUrl != null
      ? `<img class="org-card-avatar" src="${escapeHtml(String(d.avatarUrl))}" alt="" width="72" height="72" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
      : '<div class="org-card-avatar org-card-avatar-ph" aria-hidden="true"></div>';

  const linkParts = [];
  if (d.website)
    linkParts.push(
      `<a href="${escapeHtml(String(d.website))}" target="_blank" rel="noopener noreferrer">Site</a>`,
    );
  if (meta?.sourceUrl)
    linkParts.push(
      `<a href="${escapeHtml(String(meta.sourceUrl))}" target="_blank" rel="noopener noreferrer">Perfil no GitHub</a>`,
    );
  if (d.location)
    linkParts.push(`<span>${escapeHtml(String(d.location))}</span>`);
  if (d.email)
    linkParts.push(
      `<a href="mailto:${escapeHtml(String(d.email))}">${escapeHtml(String(d.email))}</a>`,
    );

  const linksRow =
    linkParts.length > 0
      ? `<div class="org-card-links">${linkParts.join(" · ")}</div>`
      : "";

  const desc =
    d.description != null && String(d.description).trim() !== ""
      ? `<p class="org-card-desc">${escapeHtml(String(d.description))}</p>`
      : "";

  const pinnedList = Array.isArray(d.pinnedRepos) ? d.pinnedRepos : [];
  const pinned = pinnedList
    .map((p) => {
      const href = `https://github.com/${encodeURIComponent(String(login))}/${encodeURIComponent(String(p.name))}`;
      const lang = p.language ? escapeHtml(String(p.language)) : "—";
      return `<li><a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(String(p.name))}</a><span class="pinned-meta">⭐ ${nf.format(Number(p.stars) || 0)} · forks ${nf.format(Number(p.forks) || 0)} · ${lang}</span></li>`;
    })
    .join("");

  const pinnedBlock =
    pinned.length > 0
      ? `<div class="pinned-block"><h4>Repositórios fixados</h4><ul class="pinned-list">${pinned}</ul></div>`
      : "";

  const extraMeta = meta
    ? `<p class="org-card-meta">HTTP em ${meta.responseTimeMs != null ? `${meta.responseTimeMs} ms` : "—"} · ${meta.proxyUsed != null ? `Proxy: ${escapeHtml(String(meta.proxyUsed))}` : "Sem proxy"} · ${escapeHtml(fmtDate(meta.fetchedAt != null ? String(meta.fetchedAt) : ""))}</p>`
    : "";

  return `
    <article class="org-card">
      ${avatar}
      <div class="org-card-head">
        <h3>${escapeHtml(String(d.name || login))}</h3>
        <span class="org-card-login">@${escapeHtml(String(login))}</span>
      </div>
      ${desc}
      ${linksRow}
      <div class="org-card-stats"><span><strong>${repos}</strong> repositórios</span><span><strong>${people}</strong> pessoas</span></div>
      ${pinnedBlock}
      ${extraMeta}
    </article>
  `;
}

/** @param {Record<string, unknown>} data */
function renderDetail(data) {
  const req = data.request;
  const status = req?.status ?? "—";
  const badge = `<span class="status-pill status-${escapeHtml(String(status))}">${escapeHtml(String(status))}</span>`;
  const idShort = escapeHtml(shortId(req?.id));
  const created = escapeHtml(fmtDate(req?.createdAt));
  if (detailBanner) {
    detailBanner.innerHTML = `${badge}<p class="detail-meta">Pedido <code>${idShort}</code> · Criado ${created}</p>`;
  }

  if (detailJson) detailJson.textContent = JSON.stringify(data, null, 2);

  if (!detailSummary) {
    syncDetailCopyButton();
    return;
  }

  if (status === "failed") {
    detailSummary.innerHTML = `<p class="detail-error">${escapeHtml(String(req?.errorMessage || "Falha sem mensagem."))}</p>`;
    if (detailJsonDetails) detailJsonDetails.classList.remove("hidden");
    syncDetailCopyButton();
    return;
  }

  if (status === "pending" || status === "processing") {
    detailSummary.innerHTML =
      status === "pending"
        ? '<p class="detail-wait">Na fila — aguardando o worker processar.</p>'
        : '<p class="detail-wait">Processando scrape…</p>';
    if (detailJsonDetails) detailJsonDetails.classList.add("hidden");
    syncDetailCopyButton();
    return;
  }

  if (status === "completed" && data.result?.data) {
    detailSummary.innerHTML = buildOrgCardHtml(data);
    if (detailJsonDetails) {
      detailJsonDetails.classList.remove("hidden");
      detailJsonDetails.open = false;
    }
    syncDetailCopyButton();
    return;
  }

  detailSummary.innerHTML =
    '<p class="detail-wait">Concluído, mas sem snapshot no armazenamento.</p>';
  if (detailJsonDetails) {
    detailJsonDetails.classList.remove("hidden");
    detailJsonDetails.open = false;
  }
  syncDetailCopyButton();
}

async function refreshList() {
  try {
    let data = await fetchListPage();
    if ((data.items ?? []).length === 0 && listOffset > 0) {
      listOffset = Math.max(0, listOffset - LIST_LIMIT);
      data = await fetchListPage();
    }
    lastListLength = (data.items ?? []).length;
    listTotal = Number(data.total ?? 0);
    renderRows(data.items ?? []);
    updatePaginationControls();
    if (selectedId) {
      const still = (data.items ?? []).some((x) => x.id === selectedId);
      if (!still) clearDetail();
    }
  } catch (e) {
    console.error(e);
  }
}

function clearDetail() {
  selectedId = null;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  const hint = detailPanel.querySelector(".hint");
  if (hint) hint.classList.remove("hidden");
  if (detailMain) detailMain.classList.add("hidden");
  if (detailBanner) detailBanner.innerHTML = "";
  if (detailSummary) detailSummary.innerHTML = "";
  if (detailJson) detailJson.textContent = "";
  if (detailJsonDetails) {
    detailJsonDetails.classList.add("hidden");
    detailJsonDetails.open = false;
  }
  syncDetailCopyButton();
  resetJsonCopyButton();
  document.querySelectorAll(".table tbody tr.selected").forEach((tr) => {
    tr.classList.remove("selected");
  });
}

async function selectRow(id) {
  selectedId = id;
  document.querySelectorAll(".table tbody tr").forEach((tr) => {
    tr.classList.toggle("selected", tr.dataset.id === id);
  });
  const hint = detailPanel.querySelector(".hint");
  if (hint) hint.classList.add("hidden");
  if (detailMain) detailMain.classList.remove("hidden");
  if (detailBanner)
    detailBanner.innerHTML = '<p class="detail-wait">Carregando…</p>';
  if (detailSummary) detailSummary.innerHTML = "";
  if (detailJson) detailJson.textContent = "";
  if (detailJsonDetails) detailJsonDetails.classList.add("hidden");
  syncDetailCopyButton();
  resetJsonCopyButton();

  if (window.innerWidth < 900 && detailPanel) {
    detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;

  const load = async () => {
    try {
      const data = await fetchOne(id);
      renderDetail(data);
      const st = data.request?.status;
      if (st === "pending" || st === "processing") {
        if (!pollTimer)
          pollTimer = setInterval(async () => {
            try {
              const d2 = await fetchOne(id);
              renderDetail(d2);
              if (
                d2.request?.status !== "pending" &&
                d2.request?.status !== "processing"
              ) {
                clearInterval(pollTimer);
                pollTimer = null;
                await refreshList();
              }
            } catch (err) {
              console.error(err);
            }
          }, 2500);
      } else {
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
        await refreshList();
      }
    } catch (e) {
      if (hint) hint.classList.add("hidden");
      if (detailMain) detailMain.classList.remove("hidden");
      if (detailBanner)
        detailBanner.innerHTML =
          '<span class="status-pill status-failed">erro</span>';
      if (detailSummary)
        detailSummary.innerHTML = `<p class="detail-error">${escapeHtml(String(e))}</p>`;
      if (detailJsonDetails) detailJsonDetails.classList.add("hidden");
    }
  };

  await load();
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  formMsg.textContent = "";
  formMsg.className = "msg";
  const fd = new FormData(form);
  const organizationName = String(fd.get("organizationName") || "").trim();
  try {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationName }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      formMsg.textContent = body.error?.message ?? `Erro HTTP ${res.status}`;
      formMsg.classList.add("err");
      return;
    }
    formMsg.textContent = `Criado: ${body.requestId}`;
    formMsg.classList.add("ok");
    form.reset();
    listOffset = 0;
    await refreshList();
    await selectRow(body.requestId);
  } catch (e) {
    formMsg.textContent = String(e);
    formMsg.classList.add("err");
  }
});

btnRefresh.addEventListener("click", () => void refreshList());

btnPrev?.addEventListener("click", () => {
  listOffset = Math.max(0, listOffset - LIST_LIMIT);
  void refreshList();
});

btnNext?.addEventListener("click", () => {
  listOffset += LIST_LIMIT;
  void refreshList();
});

void refreshList();
setInterval(() => void refreshList(), 15_000);
