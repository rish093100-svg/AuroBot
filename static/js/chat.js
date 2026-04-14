/**
 * AuroBot – Sri Aurobindo College Chatbot
 * Frontend Logic (Vanilla JS, no dependencies)
 */

(function () {
  "use strict";

  /* ── DOM references ─────────────────────────────────────────────────── */
  const launcher     = document.getElementById("launcher");
  const chatWindow   = document.getElementById("chatWindow");
  const chatBackdrop = document.getElementById("chatBackdrop");
  const chatMessages = document.getElementById("chatMessages");
  const userInput    = document.getElementById("userInput");
  const sendBtn      = document.getElementById("sendBtn");
  const closeBtn     = document.getElementById("closeBtn");
  const clearBtn     = document.getElementById("clearBtn");
  const homeBtn      = document.getElementById("homeBtn");
  const typingIndi   = document.getElementById("typingIndicator");

  /* ── State ───────────────────────────────────────────────────────────── */
  let isOpen        = false;
  let isTyping      = false;
  let messageCount  = 0;
  let initialized   = false;

  /* ── Open / Close ────────────────────────────────────────────────────── */
  function openChat() {
    isOpen = true;
    chatWindow.classList.add("is-open");
    chatBackdrop.classList.add("visible");
    launcher.classList.add("is-open");
    launcher.setAttribute("aria-expanded", "true");
    if (!initialized) { initialized = true; loadStart(); }
    setTimeout(() => userInput.focus(), 300);
  }

  function closeChat() {
    isOpen = false;
    chatWindow.classList.remove("is-open");
    chatBackdrop.classList.remove("visible");
    launcher.classList.remove("is-open");
    launcher.setAttribute("aria-expanded", "false");
  }

  function toggleChat() { isOpen ? closeChat() : openChat(); }

  launcher.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", closeChat);
  chatBackdrop.addEventListener("click", closeChat);
  homeBtn.addEventListener("click", () => { clearMessages(); loadStart(); });
  clearBtn.addEventListener("click", () => {
    clearMessages();
    addDivider("Chat cleared");
    loadStart();
  });

  /* ── Keyboard ────────────────────────────────────────────────────────── */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) closeChat();
  });
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  sendBtn.addEventListener("click", handleSend);

  /* ── Quick buttons ───────────────────────────────────────────────────── */
  document.querySelectorAll(".quick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      if (action === "faq") { loadFAQs(); return; }
      appendUserMessage(btn.textContent.trim());
      fetchNode(action);
    });
  });

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function clearMessages() { chatMessages.innerHTML = ""; messageCount = 0; }

  function scrollBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showTyping() {
    isTyping = true;
    typingIndi.classList.add("visible");
    scrollBottom();
  }

  function hideTyping() {
    isTyping = false;
    typingIndi.classList.remove("visible");
  }

  function addDivider(text) {
    const d = document.createElement("div");
    d.className = "msg-divider";
    d.textContent = text;
    chatMessages.appendChild(d);
    scrollBottom();
  }

  /* ── Render user message ─────────────────────────────────────────────── */
  function appendUserMessage(text) {
    messageCount++;
    const row = document.createElement("div");
    row.className = "msg-row user-row";
    const bubble = document.createElement("div");
    bubble.className = "msg-bubble user-bubble";
    bubble.textContent = text;
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    scrollBottom();
  }

  /* ── Render bot message ──────────────────────────────────────────────── */
  function appendBotMessage(content) {
    messageCount++;
    const row = document.createElement("div");
    row.className = "msg-row";

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="white" width="16" height="16">
      <path d="M6 9c0-.895.724-1.619 1.619-1.619h8.762C17.276 7.381 18 8.105 18 9v6c0 .895-.724 1.619-1.619 1.619H13l-3 2.381V15.619H7.619C6.724 15.619 6 14.895 6 14V9z"/>
    </svg>`;

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble bot-bubble";

    if (typeof content === "string") {
      bubble.innerHTML = formatText(content);
    } else {
      bubble.appendChild(content);
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    scrollBottom();
    return bubble;
  }

  /* ── Text formatter (bold, emoji-safe) ──────────────────────────────── */
  function formatText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  /* ── Build options chips ──────────────────────────────────────────────── */
  function buildOptions(options) {
    if (!options || options.length === 0) return null;
    const wrap = document.createElement("div");
    wrap.className = "options-wrap";

    options.forEach(opt => {
      const btn = document.createElement("button");
      btn.className = "opt-btn";

      if (opt.url) {
        btn.classList.add("url-btn");
        btn.textContent = opt.label;
        btn.title = opt.url;
        btn.addEventListener("click", () => {
          window.open(opt.url, "_blank", "noopener");
          appendUserMessage(opt.label);
          appendBotMessage(`🔗 Opening <strong>${opt.label}</strong> in a new tab…`);
        });
      } else if (opt.action === "search") {
        btn.textContent = opt.label;
        btn.addEventListener("click", () => {
          userInput.focus();
          addDivider("Type your question below");
        });
      } else if (opt.next) {
        btn.textContent = opt.label;
        btn.addEventListener("click", () => {
          appendUserMessage(opt.label);
          if (opt.next === "start") { fetchNode("start"); }
          else { fetchNode(opt.next); }
        });
      }
      wrap.appendChild(btn);
    });
    return wrap;
  }

  /* ── Render a node response ──────────────────────────────────────────── */
  function renderNode(data) {
    hideTyping();

    // Welcome card for root
    if (data.id === "start") {
      const card = buildWelcomeCard();
      appendBotMessage(card);
    }

    // Main message
    if (data.message) appendBotMessage(data.message);

    // Additional response text
    if (data.response) {
      setTimeout(() => appendBotMessage(data.response), 120);
    }

    // Details card
    if (data.details && Object.keys(data.details).length) {
      setTimeout(() => {
        const dc = buildDetailsCard(data.details);
        if (dc) {
          const row = document.createElement("div");
          row.className = "msg-row";
          const av = document.createElement("div");
          av.className = "msg-avatar";
          av.innerHTML = `<svg viewBox="0 0 24 24" fill="white" width="16" height="16">
            <path d="M6 9c0-.895.724-1.619 1.619-1.619h8.762C17.276 7.381 18 8.105 18 9v6c0 .895-.724 1.619-1.619 1.619H13l-3 2.381V15.619H7.619C6.724 15.619 6 14.895 6 14V9z"/>
          </svg>`;
          row.appendChild(av);
          row.appendChild(dc);
          chatMessages.appendChild(row);
          scrollBottom();
        }
      }, 240);
    }

    // Options
    if (data.options && data.options.length) {
      setTimeout(() => {
        const opts = buildOptions(data.options);
        if (opts) chatMessages.appendChild(opts);
        scrollBottom();
      }, 360);
    }
  }

  /* ── Render FAQ response ──────────────────────────────────────────────── */
  function renderFAQ(data) {
    hideTyping();
    const faqEl = document.createElement("div");
    faqEl.className = "faq-card";
    faqEl.innerHTML = `<div class="faq-label">💡 Quick Answer</div>${formatText(data.answer)}`;
    appendBotMessage(faqEl);

    if (data.options && data.options.length) {
      setTimeout(() => {
        const opts = buildOptions(data.options);
        if (opts) chatMessages.appendChild(opts);
        scrollBottom();
      }, 300);
    }
  }

  /* ── Render not-found ─────────────────────────────────────────────────── */
  function renderNotFound(data) {
    hideTyping();
    const el = document.createElement("div");
    el.className = "not-found-card";
    el.innerHTML = formatText(data.message || "I couldn't find that information.");
    appendBotMessage(el);

    if (data.details) {
      const dc = buildDetailsCard(data.details);
      if (dc) {
        const row = document.createElement("div");
        row.className = "msg-row";
        const av = document.createElement("div");
        av.className = "msg-avatar";
        av.innerHTML = `<svg viewBox="0 0 24 24" fill="white" width="16" height="16">
          <path d="M6 9c0-.895.724-1.619 1.619-1.619h8.762C17.276 7.381 18 8.105 18 9v6c0 .895-.724 1.619-1.619 1.619H13l-3 2.381V15.619H7.619C6.724 15.619 6 14.895 6 14V9z"/>
        </svg>`;
        row.appendChild(av);
        row.appendChild(dc);
        chatMessages.appendChild(row);
        scrollBottom();
      }
    }

    if (data.options) {
      setTimeout(() => {
        const opts = buildOptions(data.options);
        if (opts) chatMessages.appendChild(opts);
        scrollBottom();
      }, 300);
    }
  }

  /* ── Build welcome card ──────────────────────────────────────────────── */
  function buildWelcomeCard() {
    const card = document.createElement("div");
    card.className = "welcome-card";
    card.innerHTML = `
      <div class="welcome-card-title">🙏 Welcome to Sri Aurobindo College</div>
      <div class="welcome-card-sub">University of Delhi · South Delhi Campus<br>Shivalik, Malviya Nagar, New Delhi</div>
      <span class="welcome-badge">NAAC Grade B+</span>
    `;
    return card;
  }

  /* ── Build details card ───────────────────────────────────────────────── */
  function buildDetailsCard(details) {
    if (!details) return null;
    const el = document.createElement("div");
    el.className = "details-card";

    let html = "";
    const skip = ["url", "url2", "collaborations_url", "mous_url",
                   "fee_structure_url", "fee_payment_portal",
                   "erp_portal", "prospectus_url", "latest_updates_url",
                   "bulletin_of_information", "admission_incharges_url",
                   "du_csas_portal", "grievance_url", "help_desk_url",
                   "functionaries_url", "tic_url", "roster_url", "seniority_url",
                   "scholarships_url", "pmsss_nodal_officer_url"];

    for (const [key, val] of Object.entries(details)) {
      if (skip.includes(key) && typeof val === "string" && val.startsWith("http")) continue;

      const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

      if (Array.isArray(val)) {
        html += `<strong>${label}:</strong><ul class="detail-list">`;
        val.forEach(item => { html += `<li>${item}</li>`; });
        html += `</ul>`;
      } else if (typeof val === "object" && val !== null) {
        // nested – social media etc
        html += `<strong>${label}:</strong><br>`;
        for (const [k2, v2] of Object.entries(val)) {
          if (typeof v2 === "string" && v2.startsWith("http")) {
            html += `&nbsp;&nbsp;<a href="${v2}" target="_blank" rel="noopener">${k2}</a>&nbsp; `;
          }
        }
        html += "<br>";
      } else if (typeof val === "string" && val.startsWith("http")) {
        html += `<strong>${label}:</strong> <a href="${val}" target="_blank" rel="noopener">${val}</a><br>`;
      } else {
        html += `<strong>${label}:</strong> ${val}<br>`;
      }
    }

    if (!html) return null;
    el.innerHTML = html;
    return el;
  }

  /* ── API calls ───────────────────────────────────────────────────────── */
  async function fetchNode(nodeId) {
    showTyping();
    try {
      const delay = 500 + Math.random() * 300;
      await sleep(delay);
      const res = await fetch(`/api/node/${nodeId}`);
      if (!res.ok) throw new Error("Node not found");
      const data = await res.json();
      renderNode(data);
    } catch (err) {
      hideTyping();
      appendBotMessage("⚠️ Something went wrong. Please try again.");
    }
  }

  async function fetchSearch(query) {
    showTyping();
    try {
      const delay = 600 + Math.random() * 400;
      await sleep(delay);
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      const data = await res.json();

      if (data.type === "faq") { renderFAQ(data); }
      else if (data.type === "not_found") { renderNotFound(data); }
      else { renderNode(data); }

    } catch (err) {
      hideTyping();
      appendBotMessage("⚠️ Network error. Please check your connection.");
    }
  }

  async function loadStart() {
    showTyping();
    try {
      await sleep(600);
      const res = await fetch("/api/start");
      const data = await res.json();
      renderNode(data);
    } catch (err) {
      hideTyping();
      appendBotMessage("⚠️ Could not load. Please refresh.");
    }
  }

  async function loadFAQs() {
    appendUserMessage("💡 Show me FAQs");
    showTyping();
    try {
      await sleep(500);
      const res = await fetch("/api/faq");
      const faqs = await res.json();
      hideTyping();
      appendBotMessage("📋 Here are some **frequently asked questions**. Click one to see the answer:");

      // render as clickable chips
      const wrap = document.createElement("div");
      wrap.className = "options-wrap";
      wrap.style.flexDirection = "column";
      wrap.style.alignItems = "flex-start";

      faqs.slice(0, 8).forEach(faq => {
        const btn = document.createElement("button");
        btn.className = "opt-btn";
        btn.textContent = faq.question;
        btn.addEventListener("click", () => {
          appendUserMessage(faq.question);
          hideTyping();
          const faqEl = document.createElement("div");
          faqEl.className = "faq-card";
          faqEl.innerHTML = `<div class="faq-label">💡 Quick Answer</div>${faq.answer}`;
          appendBotMessage(faqEl);
          const opts = buildOptions([
            { label: "🏠 Main Menu", next: "start" },
            { label: "More FAQs", action: "faqs_reload" }
          ]);
          if (opts) {
            opts.querySelector('[data-faqs]') && (opts.querySelector('[data-faqs]').onclick = loadFAQs);
            chatMessages.appendChild(opts);
            scrollBottom();
          }
        });
        wrap.appendChild(btn);
      });
      chatMessages.appendChild(wrap);
      scrollBottom();

      const navOpts = buildOptions([{ label: "🏠 Main Menu", next: "start" }]);
      if (navOpts) chatMessages.appendChild(navOpts);
      scrollBottom();

    } catch (err) {
      hideTyping();
      appendBotMessage("⚠️ Could not load FAQs.");
    }
  }

  /* ── Handle user send ─────────────────────────────────────────────────── */
  function handleSend() {
    const text = userInput.value.trim();
    if (!text || isTyping) return;
    userInput.value = "";
    appendUserMessage(text);
    fetchSearch(text);
  }

  /* ── Utility ──────────────────────────────────────────────────────────── */
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ── Auto-open on first load (optional – disabled by default) ─────────── */
  // setTimeout(openChat, 1500);

  /* ── Expose for potential external use ───────────────────────────────── */
  window.AuroBot = { open: openChat, close: closeChat };

})();