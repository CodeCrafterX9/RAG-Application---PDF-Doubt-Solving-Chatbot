/* =========================================================
   MARGINALIA — app logic
   ---------------------------------------------------------
   This file is deliberately split into two halves:

   1. API LAYER  — every function that talks to your backend.
      This is the ONLY part you should need to touch to wire
      this up to your RAG service. Each function documents the
      request/response shape it expects. See README.md for the
      full contract.

   2. UI LAYER   — state + DOM rendering. Shouldn't need changes
      unless you're changing the design.

   MOCK_MODE ships "on" so you can open index.html directly and
   see the whole flow (upload, indexing, Q&A, citations) working
   against fake data before your backend exists. Flip it off and
   set API_BASE_URL once your backend is up.
   ========================================================= */

const CONFIG = {
  MOCK_MODE: false,
  API_BASE_URL: "https://shiny-xylophone-jj6rqxppgq7qcp47w-5000.app.github.dev/",
  /* API_BASE_URL: "http://localhost:5000", */
};

/* =========================================================
   1. API LAYER
   ========================================================= */

const Api = {
  /**
   * Upload one or more PDF files.
   * Expected backend contract:
   *   POST {API_BASE_URL}/documents
   *   Content-Type: multipart/form-data, field name "files" (repeatable)
   *
   * Expected response JSON:
   *   [
   *     { "id": "doc_123", "filename": "paper.pdf", "pages": 12, "status": "processing" },
   *     ...
   *   ]
   *
   * status is one of: "processing" | "ready" | "error"
   * If your backend indexes synchronously, just return status "ready" directly
   * and pollDocumentStatus below will never be called.
   */
async uploadDocuments(files, onProgress) {
  if (CONFIG.MOCK_MODE) {
    return MockBackend.uploadDocuments(files, onProgress);
  }

  const formData = new FormData();

  console.log("========== UPLOAD START ==========");
  console.log("API URL:", `${CONFIG.API_BASE_URL}/documents`);
  console.log("Number of files:", files.length);

  for (const file of files) {
    console.log(
      "Adding file:",
      file.name,
      "| size:",
      file.size,
      "| type:",
      file.type
    );

    formData.append("files", file);
  }

  // Check exactly what is inside FormData
  for (const [key, value] of formData.entries()) {
    console.log(
      "FormData:",
      key,
      "| filename:",
      value.name,
      "| size:",
      value.size
    );
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    const url = `${CONFIG.API_BASE_URL}/documents`;

    console.log("Opening request:", url);

    xhr.open("POST", url);

    // Optional timeout: 15 seconds
    xhr.timeout = 80000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = e.loaded / e.total;

        console.log(
          `Upload progress: ${Math.round(progress * 100)}%`
        );

        if (onProgress) {
          onProgress(progress);
        }
      }
    };

    xhr.onload = () => {
      console.log("========== SERVER RESPONSE ==========");
      console.log("HTTP Status:", xhr.status);
      console.log("Response:", xhr.responseText);

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);

          console.log("Upload successful:", data);

          resolve(data);
        } catch (error) {
          console.error("Server returned invalid JSON:", error);

          reject(
            new Error("Server response was not valid JSON")
          );
        }
      } else {
        console.error(
          `Server returned HTTP ${xhr.status}`
        );

        reject(
          new Error(`Upload failed (${xhr.status})`)
        );
      }
    };

    xhr.onerror = () => {
      console.error("========== NETWORK ERROR ==========");
      console.error("Could not connect to:", url);
      console.error("Check whether Flask is running.");
      console.error("Check the port and CORS configuration.");

      reject(
        new Error(
          `Cannot connect to backend at ${url}`
        )
      );
    };

    xhr.ontimeout = () => {
      console.error("========== REQUEST TIMEOUT ==========");
      console.error("Backend did not respond within 15 seconds.");

      reject(
        new Error(
          "Backend request timed out"
        )
      );
    };

    xhr.onabort = () => {
      console.error("========== REQUEST ABORTED ==========");

      reject(
        new Error("Upload request was aborted")
      );
    };

    console.log("Sending request now...");

    xhr.send(formData);

    console.log("xhr.send() called.");
  });
},


  /**
   * Poll a single document's indexing status.
   * Expected backend contract:
   *   GET {API_BASE_URL}/documents/{id}/status
   * Expected response JSON:
   *   { "id": "doc_123", "status": "processing" | "ready" | "error", "pages": 12 }
   */
  async getDocumentStatus(docId) {
    if (CONFIG.MOCK_MODE) return MockBackend.getDocumentStatus(docId);

    const res = await fetch(`${CONFIG.API_BASE_URL}/documents`);

    console.log("Raw response:", res);
    console.log("Status:", res.status);
    console.log("OK:", res.ok);

    if (!res.ok) throw new Error(`Status check failed (${res.status})`);
    return res.json();
  },

  /**
   * Remove a document from the index.
   * Expected backend contract:
   *   DELETE {API_BASE_URL}/documents/{id}
   */
  async deleteDocument(docId) {
    if (CONFIG.MOCK_MODE) return MockBackend.deleteDocument(docId);

    const res = await fetch(`${CONFIG.API_BASE_URL}/documents/${docId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  },

  /**
   * Ask a question against one or more documents (RAG query).
   * Expected backend contract:
   *   POST {API_BASE_URL}/chat
   *   Body JSON:
   *     {
   *       "question": "What's the refund policy?",
   *       "document_ids": ["doc_123", "doc_456"] | null,   // null / omitted = search all ready docs
   *       "history": [ { "role": "user"|"assistant", "content": "..." }, ... ]  // prior turns, for follow-ups
   *     }
   *
   * Expected response JSON:
   *   {
   *     "answer": "The refund window is 30 days from purchase.",
   *     "citations": [
   *       { "document_id": "doc_123", "filename": "policy.pdf", "page": 4, "snippet": "Refunds are honored within 30 days..." }
   *     ]
   *   }
   *
   * If you'd rather stream tokens, swap this for an EventSource/fetch-stream
   * implementation and call `onToken(chunk)` as text arrives — the UI layer's
   * `sendQuestion()` already has a hook for that, see the comment there.
   */
  async ask(question, documentIds, history) {
    if (CONFIG.MOCK_MODE) return MockBackend.ask(question, documentIds, history);

    const res = await fetch(`${CONFIG.API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, document_ids: documentIds, history }),
    });
    if (!res.ok) throw new Error(`Question failed (${res.status})`);
    return res.json();
  },
};

/* =========================================================
   MOCK BACKEND — simulates upload/indexing/Q&A so the UI is
   demoable standalone. Delete this whole block (and the
   MOCK_MODE branches above) once your real backend is wired in.
   ========================================================= */

const MockBackend = (() => {
  let counter = 0;
  const docs = new Map();

  function uploadDocuments(files, onProgress) {
    const created = [...files].map((file) => {
      const id = `doc_${++counter}`;
      docs.set(id, {
        id,
        filename: file.name,
        pages: Math.floor(8 + Math.random() * 40),
        status: "processing",
      });
      return docs.get(id);
    });

    return new Promise((resolve) => {
      let progress = 0;
      const tick = setInterval(() => {
        progress += 0.15 + Math.random() * 0.2;
        if (onProgress) onProgress(Math.min(progress, 1));
        if (progress >= 1) {
          clearInterval(tick);
          resolve(created);
        }
      }, 150);
    });
  }

  function getDocumentStatus(docId) {
    const doc = docs.get(docId);
    // Simulate indexing finishing ~1.5s after upload completes.
    if (doc && doc.status === "processing" && Math.random() > 0.4) {
      doc.status = "ready";
    }
    return Promise.resolve(doc || { id: docId, status: "error" });
  }

  function deleteDocument(docId) {
    docs.delete(docId);
    return Promise.resolve();
  }

  function ask(question, documentIds) {
    const pool = documentIds && documentIds.length
      ? documentIds.map((id) => docs.get(id)).filter(Boolean)
      : [...docs.values()];

    return new Promise((resolve) => {
      setTimeout(() => {
        if (!pool.length) {
          resolve({ answer: "There's nothing indexed yet to answer from.", citations: [] });
          return;
        }
        const cited = pool.slice(0, Math.min(2, pool.length));
        resolve({
          answer: `This is a placeholder answer to "${question}". Replace MockBackend.ask with a real call to your RAG pipeline — it should return the answer text plus the passages it drew from.`,
          citations: cited.map((d) => ({
            document_id: d.id,
            filename: d.filename,
            page: Math.floor(1 + Math.random() * d.pages),
            snippet: "This is a placeholder for the retrieved passage that supports the answer above. Your backend should return the actual chunk of text from the source PDF here.",
          })),
        });
      }, 700 + Math.random() * 600);
    });
  }

  return { uploadDocuments, getDocumentStatus, deleteDocument, ask };
})();

/* =========================================================
   2. UI LAYER
   ========================================================= */

const state = {
  documents: [],   // { id, filename, pages, status, progress }
  messages: [],    // { role, text, citations, loading }
  scope: "all",    // "all" | documentId
};

const spineColors = ["var(--spine-1)", "var(--spine-2)", "var(--spine-3)", "var(--spine-4)", "var(--spine-5)"];
const tabColors = ["var(--lamp)", "var(--sage)", "var(--spine-3)", "var(--rust)", "var(--spine-5)"];

const el = {
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  shelf: document.getElementById("shelf"),
  shelfList: document.getElementById("shelfList"),
  shelfEmpty: document.getElementById("shelfEmpty"),
  docCount: document.getElementById("docCount"),
  mobileDocCount: document.getElementById("mobileDocCount"),
  scopeChips: document.getElementById("scopeChips"),
  conversation: document.getElementById("conversation"),
  convoEmpty: document.getElementById("convoEmpty"),
  composerForm: document.getElementById("composerForm"),
  questionInput: document.getElementById("questionInput"),
  sendBtn: document.getElementById("sendBtn"),
  drawerToggle: document.getElementById("drawerToggle"),
  shelfScrim: document.getElementById("shelfScrim"),
  sourceDrawer: document.getElementById("sourceDrawer"),
  sourceScrim: document.getElementById("sourceScrim"),
  sourceDrawerBody: document.getElementById("sourceDrawerBody"),
  sourceDrawerClose: document.getElementById("sourceDrawerClose"),
};

/* ---------- upload handling ---------- */

el.dropzone.addEventListener("click", () => el.fileInput.click());
el.dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.fileInput.click(); }
});
["dragover", "dragenter"].forEach((evt) =>
  el.dropzone.addEventListener(evt, (e) => { e.preventDefault(); el.dropzone.classList.add("dragover"); })
);
["dragleave", "drop"].forEach((evt) =>
  el.dropzone.addEventListener(evt, (e) => { e.preventDefault(); el.dropzone.classList.remove("dragover"); })
);
el.dropzone.addEventListener("drop", (e) => {
  const files = [...e.dataTransfer.files].filter((f) => f.type === "application/pdf");
  if (files.length) handleFiles(files);
});
el.fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) handleFiles([...e.target.files]);
  e.target.value = "";
});

async function handleFiles(files) {
  // Placeholder rows so the shelf updates instantly, before the network responds.
  const placeholders = files.map((file) => ({
    id: `pending_${Math.random().toString(36).slice(2)}`,
    filename: file.name,
    pages: null,
    status: "processing",
    progress: 0,
  }));
  state.documents.push(...placeholders);
  renderShelf();

  try {
    
    const uploaded = await Api.uploadDocuments(files, (progress) => {
      placeholders.forEach((p) => (p.progress = progress));
      renderShelf();
    });

    console.log(state.documents)
    uploaded.forEach((doc) => {
      if (doc.status === "ready") 
        {const existing = state.documents.find((d) => d.filename === doc.filename); 
          if (existing) { 
            existing.status = "ready"; 
            existing.pages = doc.pages; 
            existing.progress = 1; 
          }
         } else { pollDocumentStatus(doc.id); } 
        
        });


    // Swap placeholders for the real records the backend returned.
    // OLD LOGIC
    // uploaded.forEach((doc, i) => {
    //   const idx = state.documents.findIndex((d) => d.id === placeholders[i].id);
    //   if (idx !== -1) state.documents[idx] = { ...doc, progress: 1 };
    // });


    renderShelf();
    renderScopeChips();
    // OLD LOGIC
    // uploaded.forEach((doc) => {
    //   if (doc.status !== "ready") pollDocumentStatus(doc.id);
    // });
  }
   catch (err) {
    placeholders.forEach((p) => (p.status = "error"));
    renderShelf();
    showToast(err.message || "Upload failed");
  }
}

async function pollDocumentStatus(docId) {
  const poll = async () => {
    try {
      const result = await Api.getDocumentStatus(docId);
      const doc = state.documents.find((d) => d.id === docId);
      if (!doc) return;
      doc.status = result.status;
      if (result.pages) doc.pages = result.pages;
      renderShelf();
      if (result.status === "processing") setTimeout(poll, 1200);
    } catch {
      const doc = state.documents.find((d) => d.id === docId);
      if (doc) { doc.status = "error"; renderShelf(); }
    }
  };
  poll();
}

async function removeDocument(docId) {
  const doc = state.documents.find((d) => d.id === docId);
  state.documents = state.documents.filter((d) => d.id !== docId);
  if (state.scope === docId) state.scope = "all";
  renderShelf();
  renderScopeChips();
  try {
    await Api.deleteDocument(docId);
  } catch {
    showToast(`Couldn't remove "${doc?.filename}" on the server`);
  }
}

/* ---------- shelf rendering ---------- */

function renderShelf() {
  el.shelf.classList.toggle("is-empty", state.documents.length === 0);
  el.docCount.textContent = state.documents.length;
  el.mobileDocCount.textContent = `${state.documents.length} doc${state.documents.length === 1 ? "" : "s"}`;

  el.shelfList.innerHTML = state.documents.map((doc, i) => {
    const color = spineColors[i % spineColors.length];
    const progressPct = Math.round((doc.progress ?? 1) * 100);
    const showProgress = doc.status === "processing" && doc.progress != null && doc.progress < 1;

    let statusLabel = "Indexing…";
    if (doc.status === "ready") statusLabel = `${doc.pages ?? "?"} page${doc.pages === 1 ? "" : "s"}`;
    else if (doc.status === "error") statusLabel = "Failed to index";
    else if (showProgress) statusLabel = `Uploading ${progressPct}%`;

    return `
      <li class="spine" style="--spine-color:${color}">
        <div class="spine-info">
          <div class="spine-name" title="${escapeHtml(doc.filename)}">${escapeHtml(doc.filename)}</div>
          <div class="spine-meta">
            <span class="spine-status ${doc.status}"><span class="spine-status-dot"></span>${statusLabel}</span>
          </div>
          ${showProgress ? `<div class="spine-progress"><div class="spine-progress-fill" style="width:${progressPct}%"></div></div>` : ""}
        </div>
        <button class="spine-remove" data-remove="${doc.id}" aria-label="Remove ${escapeHtml(doc.filename)}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </li>
    `;
  }).join("");

  el.shelfList.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => removeDocument(btn.dataset.remove));
  });

  updateComposerAvailability();
}

function renderScopeChips() {
  const readyDocs = state.documents.filter((d) => d.status === "ready");
  const chips = [`<button class="chip chip-all ${state.scope === "all" ? "active" : ""}" data-scope="all">All documents</button>`]
    .concat(readyDocs.map((d) => `
      <button class="chip ${state.scope === d.id ? "active" : ""}" data-scope="${d.id}" title="${escapeHtml(d.filename)}">
        ${escapeHtml(truncate(d.filename.replace(/\.pdf$/i, ""), 22))}
      </button>
    `));
  el.scopeChips.innerHTML = chips.join("");

  el.scopeChips.querySelectorAll("[data-scope]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.scope = btn.dataset.scope;
      renderScopeChips();
    });
  });
}

function updateComposerAvailability() {
  const hasReadyDoc = state.documents.some((d) => d.status === "ready");
  el.questionInput.disabled = !hasReadyDoc;
  el.sendBtn.disabled = !hasReadyDoc || el.questionInput.value.trim() === "";
  el.questionInput.placeholder = hasReadyDoc
    ? "Ask something about your documents…"
    : "Add a PDF and wait for it to finish indexing…";
}

/* ---------- chat ---------- */

el.questionInput.addEventListener("input", () => {
  el.sendBtn.disabled = el.questionInput.disabled || el.questionInput.value.trim() === "";
  el.questionInput.style.height = "auto";
  el.questionInput.style.height = Math.min(el.questionInput.scrollHeight, 140) + "px";
});
el.questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    el.composerForm.requestSubmit();
  }
});
el.composerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = el.questionInput.value.trim();
  if (!question) return;
  sendQuestion(question);
  el.questionInput.value = "";
  el.questionInput.style.height = "auto";
  updateComposerAvailability();
});

async function sendQuestion(question) {
  el.convoEmpty.style.display = "none";

  state.messages.push({ role: "user", text: question });
  const loadingMsg = { role: "assistant", loading: true };
  state.messages.push(loadingMsg);
  renderConversation();

  const documentIds = state.scope === "all" ? null : [state.scope];
  const history = state.messages
    .filter((m) => !m.loading)
    .slice(0, -1)
    .map((m) => ({ role: m.role, content: m.text }));

  try {
    // NOTE: if you switch Api.ask to a streaming implementation, update
    // loadingMsg.text incrementally here and call renderConversation()
    // on each chunk instead of waiting for the full response.
    const result = await Api.ask(question, documentIds, history);
    loadingMsg.loading = false;
    loadingMsg.text = result.answer;
    loadingMsg.citations = result.citations || [];
  } catch (err) {
    loadingMsg.loading = false;
    loadingMsg.text = "Something went wrong answering that — check your backend connection and try again.";
    loadingMsg.isError = true;
  }
  renderConversation();
}

function renderConversation() {
  el.conversation.innerHTML = state.messages.map((msg, i) => {
    if (msg.role === "user") {
      return `<div class="msg-row from-user"><div class="msg-user-bubble">${escapeHtml(msg.text)}</div></div>`;
    }
    const bodyHtml = msg.loading
      ? `<p class="msg-paper-text is-loading">Reading the documents <span class="typing-dots"><span></span><span></span><span></span></span></p>`
      : `<p class="msg-paper-text">${escapeHtml(msg.text)}</p>`;
    const citationsHtml = (msg.citations && msg.citations.length)
      ? `<div class="citations">${msg.citations.map((c, ci) => `
          <button class="citation-tab" style="--tab-color:${tabColors[ci % tabColors.length]}" data-msg="${i}" data-citation="${ci}">
            ${escapeHtml(truncate(c.filename.replace(/\.pdf$/i, ""), 18))} <span class="tab-page">p.${c.page}</span>
          </button>
        `).join("")}</div>`
      : "";
    return `<div class="msg-row from-assistant"><div class="msg-paper">${bodyHtml}${citationsHtml}</div></div>`;
  }).join("");

  el.conversation.querySelectorAll("[data-citation]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const msg = state.messages[btn.dataset.msg];
      const citation = msg.citations[btn.dataset.citation];
      openSourceDrawer(citation);
    });
  });

  el.conversation.scrollTop = el.conversation.scrollHeight;
}

/* ---------- source drawer ---------- */

function openSourceDrawer(citation) {
  document.getElementById("sourceDrawerTitle").textContent = `${citation.filename} · page ${citation.page}`;
  el.sourceDrawerBody.innerHTML = `
    <h3>${escapeHtml(citation.filename)}</h3>
    <span class="source-page-tag">Page ${citation.page}</span>
    <div class="source-snippet">${escapeHtml(citation.snippet || "No snippet returned by the backend for this citation.")}</div>
  `;
  el.sourceDrawer.classList.add("open");
  el.sourceScrim.classList.add("open");
}
function closeSourceDrawer() {
  el.sourceDrawer.classList.remove("open");
  el.sourceScrim.classList.remove("open");
}
el.sourceDrawerClose.addEventListener("click", closeSourceDrawer);
el.sourceScrim.addEventListener("click", closeSourceDrawer);

/* ---------- mobile shelf drawer ---------- */

el.drawerToggle.addEventListener("click", () => {
  el.shelf.classList.add("open");
  el.shelfScrim.classList.add("open");
});
el.shelfScrim.addEventListener("click", () => {
  el.shelf.classList.remove("open");
  el.shelfScrim.classList.remove("open");
});

/* ---------- utilities ---------- */

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}
let toastTimer;
function showToast(text) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

/* ---------- init ---------- */

renderShelf();
renderScopeChips();