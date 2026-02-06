// Simple in-browser "backend" using localStorage

const STORAGE_KEYS = {
  USERNAME: "og_username",
  THEME: "og_theme",
  POSTS: "og_posts",
  REACTIONS: "og_reactions",
  CONVERSATIONS: "og_conversations",
  ADMIN: "og_admin_logged_in",
  USED_NAMES: "og_used_names",
  ADS: "og_ads",
};



const ADMIN_CREDENTIALS = {
  name: "Admin",
  password: "Bruk12345678",
};

let state = {
  currentUser: null,
  posts: [],
  reactions: {}, // { [postId]: { likes: Set(user), dislikes: Set(user) } } - stored in localStorage as arrays
  conversations: {}, // { conversationId: { participants: [a,b], messages: [] } }
  usedNames: new Set(), // names that can no longer be used
  ads: [], // {id,title,text,link,createdAt}
  sort: "new",
  filterCategory: "all",
  isAdmin: false,
};

function loadState() {
  const username = localStorage.getItem(STORAGE_KEYS.USERNAME);
  const postsRaw = localStorage.getItem(STORAGE_KEYS.POSTS);
  const reactionsRaw = localStorage.getItem(STORAGE_KEYS.REACTIONS);
  const convRaw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
  const usedNamesRaw = localStorage.getItem(STORAGE_KEYS.USED_NAMES);
  const adsRaw = localStorage.getItem(STORAGE_KEYS.ADS);
  const admin = localStorage.getItem(STORAGE_KEYS.ADMIN) === "true";

  state.currentUser = username || null;
  state.posts = postsRaw ? JSON.parse(postsRaw) : [];
  state.reactions = reactionsRaw ? reviveReactions(JSON.parse(reactionsRaw)) : {};
  state.conversations = convRaw ? JSON.parse(convRaw) : {};
  state.usedNames = new Set(usedNamesRaw ? JSON.parse(usedNamesRaw) : []);
  state.ads = adsRaw ? JSON.parse(adsRaw) : [];
  state.isAdmin = admin;
}

function openTelegram() {
  window.open("https://t.me/+ZGrGm0hea8RiMTIy", "_blank");
}

function savePosts() {
  localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(state.posts));
}

function saveReactions() {
  const serializable = {};
  Object.entries(state.reactions).forEach(([id, r]) => {
    serializable[id] = {
      likes: Array.from(r.likes),
      dislikes: Array.from(r.dislikes),
    };
  });
  localStorage.setItem(STORAGE_KEYS.REACTIONS, JSON.stringify(serializable));
}

function reviveReactions(obj) {
  const res = {};
  Object.entries(obj).forEach(([id, r]) => {
    res[id] = {
      likes: new Set(r.likes || []),
      dislikes: new Set(r.dislikes || []),
    };
  });
  return res;
}

function saveConversations() {
  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(state.conversations));
}

function saveUsedNames() {
  localStorage.setItem(STORAGE_KEYS.USED_NAMES, JSON.stringify(Array.from(state.usedNames)));
}

function saveAds() {
  localStorage.setItem(STORAGE_KEYS.ADS, JSON.stringify(state.ads));
}

function saveTheme(theme) {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

function loadTheme() {
  const stored = localStorage.getItem(STORAGE_KEYS.THEME);
  if (stored === "light" || stored === "dark") {
    document.documentElement.setAttribute("data-theme", stored);
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}

// Helpers

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatTime(ts) {
  const date = new Date(ts);
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function categoryLabel(cat) {
  switch (cat) {
    case "problem":
      return "Проблема";
    case "idea":
      return "Идея / предложение";
    case "praise":
      return "Благодарность";
    default:
      return "Другое";
  }
}

function conversationIdFor(a, b) {
  const [x, y] = [a, b].sort();
  return `${x}__${y}`;
}

// Rendering

function renderAll() {
  updateUserUI();
  renderFeed();
  renderMyPosts();
  renderConversationsList();
  renderAdmin();
}

function updateUserUI() {
  const curNameSpan = document.getElementById("current-username");
  const profileUsername = document.getElementById("profile-username");
  if (state.currentUser) {
    curNameSpan.textContent = state.currentUser;
    if (profileUsername) profileUsername.textContent = state.currentUser;
  } else {
    curNameSpan.textContent = "";
    if (profileUsername) profileUsername.textContent = "";
  }
}

function filteredSortedPosts() {
  let posts = [...state.posts];
  if (state.filterCategory !== "all") {
    posts = posts.filter((p) => p.category === state.filterCategory);
  }
  if (state.sort === "top") {
    posts.sort((a, b) => {
      const rA = state.reactions[a.id] || { likes: new Set(), dislikes: new Set() };
      const rB = state.reactions[b.id] || { likes: new Set(), dislikes: new Set() };
      const scoreA = rA.likes.size - rA.dislikes.size;
      const scoreB = rB.likes.size - rB.dislikes.size;
      return scoreB - scoreA;
    });
  } else if (state.sort === "discussed") {
    posts.sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0));
  } else {
    posts.sort((a, b) => b.createdAt - a.createdAt);
  }
  return posts;
}

function renderFeed() {
  const container = document.getElementById("feed-list");
  container.innerHTML = "";
  const posts = filteredSortedPosts();
  if (!posts.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Пока ещё нет публикаций. Будьте первым, кто расскажет о проблеме или идее для Чебоксар.";
    container.appendChild(p);
    return;
  }
  posts.forEach((post) => {
    container.appendChild(renderPostCard(post));
  });
}

function renderMyPosts() {
  const container = document.getElementById("my-posts-list");
  container.innerHTML = "";
  if (!state.currentUser) return;
  const posts = state.posts.filter((p) => p.author === state.currentUser).sort((a, b) => b.createdAt - a.createdAt);
  if (!posts.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Вы ещё не публиковали посты. Поделитесь мнением в ленте.";
    container.appendChild(p);
    return;
  }
  posts.forEach((post) => container.appendChild(renderPostCard(post, { hideMessageButton: true })));
}

function renderPostCard(post, options = {}) {
  const { hideMessageButton = false } = options;
  const reactions = state.reactions[post.id] || { likes: new Set(), dislikes: new Set() };
  const liked = reactions.likes.has(state.currentUser);
  const disliked = reactions.dislikes.has(state.currentUser);

  const card = document.createElement("article");
  card.className = "post-card";
  card.dataset.postId = post.id;

  const header = document.createElement("div");
  header.className = "post-header";

  const author = document.createElement("div");
  author.className = "post-author";
  const avatar = document.createElement("div");
  avatar.className = "avatar-circle";
  avatar.textContent = (post.author || "?").slice(0, 2).toUpperCase();
  const authorName = document.createElement("button");
  authorName.className = "author-name link-button";
  authorName.type = "button";
  authorName.textContent = post.author;
  authorName.addEventListener("click", () => openProfileOf(post.author));
  author.appendChild(avatar);
  author.appendChild(authorName);

  const meta = document.createElement("div");
  meta.className = "post-meta";
  const time = document.createElement("div");
  time.className = "post-time";
  time.textContent = formatTime(post.createdAt);
  const tag = document.createElement("div");
  tag.className = "post-tag";
  tag.textContent = categoryLabel(post.category);
  meta.appendChild(time);
  meta.appendChild(tag);

  header.appendChild(author);
  header.appendChild(meta);

  const body = document.createElement("div");
  body.className = "post-body";
  body.textContent = post.text;

  card.appendChild(header);
  card.appendChild(body);

  if (post.imageDataUrl) {
    const img = document.createElement("img");
    img.className = "post-image";
    img.src = post.imageDataUrl;
    img.alt = "Фото к обращению";
    card.appendChild(img);
  }

  const footer = document.createElement("div");
  footer.className = "post-footer";

  const actions = document.createElement("div");
  actions.className = "post-actions";

  const likeBtn = document.createElement("button");
  likeBtn.className = `action-btn action-like ${liked ? "liked" : ""}`;
  likeBtn.innerHTML = `👍 <span>${reactions.likes.size}</span>`;
  likeBtn.addEventListener("click", () => toggleReaction(post.id, "like"));

  const dislikeBtn = document.createElement("button");
  dislikeBtn.className = `action-btn action-dislike ${disliked ? "disliked" : ""}`;
  dislikeBtn.innerHTML = `👎 <span>${reactions.dislikes.size}</span>`;
  dislikeBtn.addEventListener("click", () => toggleReaction(post.id, "dislike"));

  const commentsBtn = document.createElement("button");
  commentsBtn.className = "action-btn action-comments";
  const commentsCount = post.comments?.length || 0;
  commentsBtn.innerHTML = `💬 <span>${commentsCount}</span>`;

  actions.appendChild(likeBtn);
  actions.appendChild(dislikeBtn);
  actions.appendChild(commentsBtn);

  const extra = document.createElement("div");
  extra.className = "post-extra-actions";
  if (!hideMessageButton && state.currentUser && post.author !== state.currentUser) {
    const dmBtn = document.createElement("button");
    dmBtn.className = "link-button";
    dmBtn.type = "button";
    dmBtn.textContent = "Написать лично";
    dmBtn.addEventListener("click", () => startConversationWith(post.author));
    extra.appendChild(dmBtn);
  }

  footer.appendChild(actions);
  footer.appendChild(extra);

  card.appendChild(footer);

  // Comments section
  const commentsSection = document.createElement("div");
  commentsSection.className = "post-comments hidden";
  const commentsList = document.createElement("div");
  commentsList.className = "comments-list";

  (post.comments || []).forEach((c) => {
    commentsList.appendChild(renderComment(c));
  });

  const commentForm = document.createElement("form");
  commentForm.className = "comment-form";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Оставить комментарий...";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Отправить";
  commentForm.appendChild(input);
  commentForm.appendChild(submit);

  commentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || !state.currentUser) return;
    addComment(post.id, text);
    input.value = "";
  });

  commentsSection.appendChild(commentsList);
  commentsSection.appendChild(commentForm);

  commentsBtn.addEventListener("click", () => {
    const isHidden = commentsSection.classList.contains("hidden");
    commentsSection.classList.toggle("hidden");
    commentsBtn.classList.toggle("active", isHidden);
  });

  card.appendChild(commentsSection);

  return card;
}

function renderComment(c) {
  const div = document.createElement("div");
  div.className = "comment";
  const author = document.createElement("span");
  author.className = "comment-author";
  author.textContent = c.author;
  const text = document.createElement("span");
  text.className = "comment-text";
  text.textContent = c.text;
  div.appendChild(author);
  div.appendChild(text);
  return div;
}

// Reactions & comments

function ensureReaction(postId) {
  if (!state.reactions[postId]) {
    state.reactions[postId] = {
      likes: new Set(),
      dislikes: new Set(),
    };
  }
}

function toggleReaction(postId, type) {
  if (!state.currentUser) return;
  ensureReaction(postId);
  const r = state.reactions[postId];
  if (type === "like") {
    if (r.likes.has(state.currentUser)) {
      r.likes.delete(state.currentUser);
    } else {
      r.likes.add(state.currentUser);
      r.dislikes.delete(state.currentUser);
    }
  } else {
    if (r.dislikes.has(state.currentUser)) {
      r.dislikes.delete(state.currentUser);
    } else {
      r.dislikes.add(state.currentUser);
      r.likes.delete(state.currentUser);
    }
  }
  saveReactions();
  renderFeed();
  renderMyPosts();
}

function addComment(postId, text) {
  const idx = state.posts.findIndex((p) => p.id === postId);
  if (idx === -1) return;
  if (!state.posts[idx].comments) state.posts[idx].comments = [];
  state.posts[idx].comments.push({
    id: generateId(),
    author: state.currentUser,
    text,
    createdAt: Date.now(),
  });
  savePosts();
  renderFeed();
  renderMyPosts();
}

// Conversations

let currentConversationId = null;

function renderConversationsList() {
  const list = document.getElementById("conversations-list");
  list.innerHTML = "";
  if (!state.currentUser) return;
  const entries = Object.entries(state.conversations).filter(([_, conv]) =>
    conv.participants.includes(state.currentUser)
  );
  if (!entries.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.style.padding = "8px 10px";
    p.textContent = "У вас пока нет личных сообщений. Откройте профиль автора поста или нажмите «Написать лично».";
    list.appendChild(p);
    return;
  }
  entries
    .sort(([, a], [, b]) => {
      const lastA = a.messages[a.messages.length - 1];
      const lastB = b.messages[b.messages.length - 1];
      return (lastB?.createdAt || 0) - (lastA?.createdAt || 0);
    })
    .forEach(([id, conv]) => {
      const other = conv.participants.find((p) => p !== state.currentUser) || "Аноним";
      const item = document.createElement("div");
      item.className = "conversation-item";
      item.dataset.conversationId = id;
      if (id === currentConversationId) {
        item.classList.add("active");
      }

      const main = document.createElement("div");
      main.className = "conversation-main";
      const name = document.createElement("div");
      name.className = "conversation-name";
      name.textContent = other;
      const last = document.createElement("div");
      last.className = "conversation-last";
      const lastMsg = conv.messages[conv.messages.length - 1];
      last.textContent = lastMsg ? lastMsg.text.slice(0, 40) + (lastMsg.text.length > 40 ? "…" : "") : "Нет сообщений";
      main.appendChild(name);
      main.appendChild(last);

      const meta = document.createElement("div");
      meta.className = "conversation-meta";
      meta.textContent = lastMsg ? formatTime(lastMsg.createdAt) : "";

      item.appendChild(main);
      item.appendChild(meta);

      item.addEventListener("click", () => openConversation(id));

      list.appendChild(item);
    });
}

function openConversation(id) {
  currentConversationId = id;
  renderConversationsList();
  renderConversationPanel();
}

function renderConversationPanel() {
  const header = document.getElementById("conversation-header");
  const withSpan = document.getElementById("conversation-with");
  const messagesContainer = document.getElementById("conversation-messages");
  const form = document.getElementById("conversation-form");
  const input = document.getElementById("conversation-input");

  messagesContainer.innerHTML = "";

  const conv = state.conversations[currentConversationId];
  if (!conv || !state.currentUser) {
    withSpan.textContent = "Выберите диалог слева";
    form.classList.add("hidden");
    return;
  }

  const other = conv.participants.find((p) => p !== state.currentUser) || "Аноним";
  withSpan.textContent = `Диалог с: ${other}`;
  form.classList.remove("hidden");

  conv.messages.forEach((m) => {
    const div = document.createElement("div");
    div.className = `dm-message ${m.from === state.currentUser ? "me" : "them"}`;
    const text = document.createElement("div");
    text.textContent = m.text;
    const meta = document.createElement("div");
    meta.className = "dm-meta";
    meta.textContent = formatTime(m.createdAt);
    div.appendChild(text);
    div.appendChild(meta);
    messagesContainer.appendChild(div);
  });

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  form.onsubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    sendMessageToConversation(currentConversationId, text);
    input.value = "";
  };
}

function ensureConversationWith(user) {
  if (!state.currentUser || !user || user === state.currentUser) return null;
  const id = conversationIdFor(state.currentUser, user);
  if (!state.conversations[id]) {
    state.conversations[id] = {
      id,
      participants: [state.currentUser, user],
      messages: [],
    };
  }
  return id;
}

function startConversationWith(user) {
  const id = ensureConversationWith(user);
  if (!id) return;
  currentConversationId = id;
  switchView("messages");
  renderConversationsList();
  renderConversationPanel();
}

function sendMessageToConversation(id, text) {
  const conv = state.conversations[id];
  if (!conv || !state.currentUser) return;
  conv.messages.push({
    id: generateId(),
    from: state.currentUser,
    text,
    createdAt: Date.now(),
  });
  saveConversations();
  renderConversationsList();
  renderConversationPanel();
}

// Profile navigation

function openProfileOf(name) {
  // Simple behaviour: open messages view and start conversation
  if (name === state.currentUser) {
    switchView("profile");
  } else {
    startConversationWith(name);
  }
}

// Admin

function renderAdmin() {
  const loginCard = document.getElementById("admin-login-card");
  const panelCard = document.getElementById("admin-panel-card");
  const inbox = document.getElementById("admin-inbox");
  const adminAdsList = document.getElementById("admin-ads-list");
  if (!loginCard || !panelCard || !inbox) return;

  if (!state.isAdmin) {
    loginCard.classList.remove("hidden");
    panelCard.classList.add("hidden");
    if (adminAdsList) adminAdsList.innerHTML = "";
    return;
  }

  loginCard.classList.add("hidden");
  panelCard.classList.remove("hidden");
  inbox.innerHTML = "";
  if (adminAdsList) adminAdsList.innerHTML = "";

  const postsForAdmin = state.posts.slice().sort((a, b) => b.createdAt - a.createdAt);

  if (!postsForAdmin.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Обращений пока нет.";
    inbox.appendChild(p);
  } else {
    postsForAdmin.forEach((post) => {
      const item = document.createElement("div");
      item.className = "admin-item";
      item.dataset.postId = post.id;

      const header = document.createElement("div");
      header.className = "admin-item-header";
      const left = document.createElement("div");
      const author = document.createElement("div");
      author.textContent = `Автор: ${post.author}`;
      author.style.fontWeight = "600";
      const time = document.createElement("div");
      time.className = "post-time";
      time.textContent = formatTime(post.createdAt);
      left.appendChild(author);
      left.appendChild(time);

      const right = document.createElement("div");
      const badge = document.createElement("span");
      badge.className = "admin-badge";
      badge.textContent = categoryLabel(post.category);

      const status = document.createElement("span");
      status.className = "admin-status admin-status-open";
      status.textContent = "Открыто";
      status.dataset.status = "open";

      right.appendChild(badge);
      right.appendChild(status);

      header.appendChild(left);
      header.appendChild(right);

      const text = document.createElement("div");
      text.style.marginTop = "4px";
      text.textContent = post.text;

      item.appendChild(header);
      item.appendChild(text);

      if (post.imageDataUrl) {
        const img = document.createElement("img");
        img.className = "post-image";
        img.src = post.imageDataUrl;
        img.alt = "Фото к обращению";
        img.style.marginTop = "6px";
        item.appendChild(img);
      }

      const actions = document.createElement("div");
      actions.className = "admin-item-actions";
      const markDone = document.createElement("button");
      markDone.className = "link-button";
      markDone.textContent = "Отметить обработанным";
      markDone.addEventListener("click", () => {
        status.classList.remove("admin-status-open");
        status.classList.add("admin-status-done");
        status.textContent = "Передано в работу";
        status.dataset.status = "done";
      });
      const exportBtn = document.createElement("button");
      exportBtn.className = "link-button";
      exportBtn.textContent = "Скопировать для отчёта";
      exportBtn.addEventListener("click", () => {
        const report = `Город говорит — обращение\nАвтор: ${post.author}\nКатегория: ${categoryLabel(
          post.category
        )}\nВремя: ${formatTime(post.createdAt)}\n\nТекст:\n${post.text}`;
        navigator.clipboard?.writeText(report).catch(() => {});
        alert("Текст обращения скопирован в буфер обмена.");
      });
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "link-button";
      deleteBtn.textContent = "Удалить пост";
      deleteBtn.addEventListener("click", () => {
        if (!confirm("Удалить этот пост без возможности восстановления?")) return;
        state.posts = state.posts.filter((p) => p.id !== post.id);
        delete state.reactions[post.id];
        savePosts();
        saveReactions();
        renderFeed();
        renderMyPosts();
        renderAdmin();
      });

      actions.appendChild(markDone);
      actions.appendChild(exportBtn);
      actions.appendChild(deleteBtn);
      item.appendChild(actions);

      inbox.appendChild(item);
    });
  }

  if (adminAdsList) {
    if (!state.ads.length) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "Рекламные блоки ещё не настроены.";
      adminAdsList.appendChild(p);
    } else {
      state.ads
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .forEach((ad) => {
          const row = document.createElement("div");
          row.className = "admin-ad-row";
          const main = document.createElement("div");
          main.className = "admin-ad-main";
          const title = document.createElement("div");
          title.className = "admin-ad-title";
          title.textContent = ad.title;
          const text = document.createElement("div");
          text.className = "admin-ad-text";
          text.textContent = ad.text;
          main.appendChild(title);
          main.appendChild(text);
          if (ad.link) {
            const link = document.createElement("div");
            link.className = "admin-ad-link";
            link.textContent = ad.link;
            main.appendChild(link);
          }

          const controls = document.createElement("div");
          controls.className = "admin-ad-controls";
          const del = document.createElement("button");
          del.className = "link-button";
          del.textContent = "Удалить";
          del.addEventListener("click", () => {
            state.ads = state.ads.filter((a) => a.id !== ad.id);
            saveAds();
            renderAdmin();
          });

          controls.appendChild(del);
          row.appendChild(main);
          row.appendChild(controls);
          adminAdsList.appendChild(row);
        });
    }
  }
}

// Views

function switchView(view) {
  const map = {
    feed: "view-feed",
    messages: "view-messages",
    profile: "view-profile",
    admin: "view-admin",
  };
  Object.values(map).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("view-active");
  });
  const targetId = map[view];
  const viewEl = document.getElementById(targetId);
  if (viewEl) viewEl.classList.add("view-active");

  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  if (view === "messages") {
    renderConversationsList();
    renderConversationPanel();
  }
}

// Initialization & event bindings

document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  loadState();

  const welcomeScreen = document.getElementById("welcome-screen");
  const mainLayout = document.getElementById("main-layout");
  const welcomeForm = document.getElementById("welcome-form");

  if (state.currentUser) {
    welcomeScreen.classList.add("hidden");
    mainLayout.classList.remove("hidden");
    updateUserUI();
  } else {
    welcomeScreen.classList.remove("hidden");
    mainLayout.classList.add("hidden");
  }

  welcomeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("displayName");
    const name = input.value.trim();
    if (!name) return;
    if (state.usedNames.has(name)) {
      alert("Этот псевдоним уже использовался и больше недоступен. Пожалуйста, выберите другое имя.");
      return;
    }
    state.currentUser = name;
    localStorage.setItem(STORAGE_KEYS.USERNAME, name);
    welcomeScreen.classList.add("hidden");
    mainLayout.classList.remove("hidden");
    updateUserUI();
    renderAll();
  });
  // Logout (user)
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (!state.currentUser) return;
      state.usedNames.add(state.currentUser);
      saveUsedNames();
      localStorage.removeItem(STORAGE_KEYS.USERNAME);
      state.currentUser = null;
      updateUserUI();
      renderConversationsList();
      switchView("feed");
      welcomeScreen.classList.remove("hidden");
      mainLayout.classList.add("hidden");
    });
  }

  // Navigation
  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchView(btn.dataset.view);
    });
  });

  // Feed filters
  document.querySelectorAll(".feed-filters .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".feed-filters .chip").forEach((c) => c.classList.remove("chip-active"));
      chip.classList.add("chip-active");
      state.sort = chip.dataset.sort;
      renderFeed();
    });
  });

  const categoryFilter = document.getElementById("feed-category-filter");
  categoryFilter.addEventListener("change", () => {
    state.filterCategory = categoryFilter.value;
    renderFeed();
  });

  // Post form
  const postForm = document.getElementById("post-form");
  const postText = document.getElementById("post-text");
  const postImageInput = document.getElementById("post-image");
  const postImageName = document.getElementById("post-image-name");
  const postCategory = document.getElementById("post-category");

  postImageInput.addEventListener("change", () => {
    const file = postImageInput.files[0];
    postImageName.textContent = file ? file.name : "";
  });

  postForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!state.currentUser) return;
    const text = postText.value.trim();
    if (!text) return;
    const category = postCategory.value;
    const file = postImageInput.files[0];

    const createPost = (imageDataUrl) => {
      const post = {
        id: generateId(),
        author: state.currentUser,
        text,
        category,
        imageDataUrl: imageDataUrl || null,
        createdAt: Date.now(),
        city: "Чебоксары",
        comments: [],
      };
      state.posts.push(post);
      savePosts();
      renderFeed();
      renderMyPosts();
      renderAdmin();

      postText.value = "";
      postImageInput.value = "";
      postImageName.textContent = "";
      postCategory.value = "problem";
    };

    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        createPost(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      createPost(null);
    }
  });

  // Change name
  const changeNameBtn = document.getElementById("change-name-btn");
  changeNameBtn.addEventListener("click", () => {
    const newName = prompt("Введите новый псевдоним:", state.currentUser || "");
    if (!newName) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (state.usedNames.has(trimmed)) {
      alert("Этот псевдоним уже недоступен. Попробуйте другое имя.");
      return;
    }

    // Update posts & conversations to keep continuity
    state.posts.forEach((p) => {
      if (p.author === state.currentUser) p.author = trimmed;
      p.comments?.forEach((c) => {
        if (c.author === state.currentUser) c.author = trimmed;
      });
    });
    Object.values(state.conversations).forEach((conv) => {
      conv.participants = conv.participants.map((p) => (p === state.currentUser ? trimmed : p));
      conv.messages.forEach((m) => {
        if (m.from === state.currentUser) m.from = trimmed;
      });
    });

    if (state.currentUser) {
      state.usedNames.add(state.currentUser);
      saveUsedNames();
    }

    state.currentUser = trimmed;
    localStorage.setItem(STORAGE_KEYS.USERNAME, trimmed);
    savePosts();
    saveConversations();
    updateUserUI();
    renderAll();
  });

  // Admin login/logout
  const adminLoginForm = document.getElementById("admin-login-form");
  const adminLogoutBtn = document.getElementById("admin-logout-btn");

  adminLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("admin-name").value.trim();
    const pass = document.getElementById("admin-password").value;
    if (name === ADMIN_CREDENTIALS.name && pass === ADMIN_CREDENTIALS.password) {
      state.isAdmin = true;
      localStorage.setItem(STORAGE_KEYS.ADMIN, "true");
      renderAdmin();
    } else {
      alert("Неверные данные администратора.");
    }
  });

  adminLogoutBtn.addEventListener("click", () => {
    state.isAdmin = false;
    localStorage.removeItem(STORAGE_KEYS.ADMIN);
    renderAdmin();
  });

  // Admin ads form
  const adminAdForm = document.getElementById("admin-ad-form");
  if (adminAdForm) {
    adminAdForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!state.isAdmin) return;
      const titleInput = document.getElementById("admin-ad-title");
      const textInput = document.getElementById("admin-ad-text");
      const linkInput = document.getElementById("admin-ad-link");
      const title = titleInput.value.trim();
      const text = textInput.value.trim();
      const link = linkInput.value.trim();
      if (!title || !text) return;
      state.ads.push({
        id: generateId(),
        title,
        text,
        link: link || null,
        createdAt: Date.now(),
      });
      saveAds();
      titleInput.value = "";
      textInput.value = "";
      linkInput.value = "";
      renderAdmin();
    });
  }

  // Initial render
  renderAll();
});

/* ==========================================
   EXTRA UI EFFECTS
========================================== */


/* ripple on all buttons */

document.addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  btn.classList.add("ripple");
});


/* scroll to top */

const topBtn = document.getElementById("scrollTopBtn");

window.addEventListener("scroll",()=>{
  if(window.scrollY > 300){
    topBtn.classList.add("show");
  } else {
    topBtn.classList.remove("show");
  }
});

topBtn.onclick=()=>{
  window.scrollTo({top:0,behavior:"smooth"});
};


/* ==========================================
   MORE VISUAL EFFECTS
========================================== */


/* ========= PARALLAX FLOATING BACKGROUND ========= */

const floatBg = document.querySelector(".floating-bg");

document.addEventListener("mousemove",(e)=>{
  const x = (e.clientX / window.innerWidth - .5) * 20;
  const y = (e.clientY / window.innerHeight - .5) * 20;

  floatBg.style.transform = `translate(${x}px, ${y}px)`;
});


/* ========= CARD FADE-IN ON SCROLL ========= */

const observer = new IntersectionObserver(entries=>{
  entries.forEach(en=>{
    if(en.isIntersecting){
      en.target.classList.add("show");
    }
  });
},{
  threshold:.15
});

function observeCards(){
  document.querySelectorAll(".post-card").forEach(c=>{
    observer.observe(c);
  });
}

/* вызываем после каждой перерисовки ленты */

const oldRenderFeed = renderFeed;
renderFeed = function(){
  oldRenderFeed();
  observeCards();
};


/* ========= EMOJI BURST ON REACTION ========= */

document.addEventListener("click",e=>{
  if (!e.target.closest(".action-like, .action-dislike")) return;
  const target = e.target.closest("button");
  target.textContent="✨";
  target.style.position="absolute";
  target.style.pointerEvents="none";
  target.style.fontSize="18px";

  const rect = target.getBoundingClientRect();
  target.style.left=rect.left+"px";
  target.style.top=rect.top+"px";

  document.body.appendChild(target);

  target.animate([
    {transform:"translateY(0)",opacity:1},
    {transform:"translateY(-30px)",opacity:0}
  ],{duration:600});

  setTimeout(()=>target.remove(),600);
});


/* ==========================================
   THEME BUTTON FIX (safe override)
========================================== */

document.addEventListener("DOMContentLoaded",()=>{

  const btn = document.getElementById("theme-toggle");
  if(!btn) return;

  function updateIcon(){
    const theme=document.documentElement.getAttribute("data-theme");
    btn.textContent = theme==="dark" ? "🌙" : "☀️";
  }

  btn.addEventListener("click",()=>{
    const cur=document.documentElement.getAttribute("data-theme");
    const next=cur==="dark"?"light":"dark";

    document.documentElement.setAttribute("data-theme",next);
    localStorage.setItem("gg_theme",next);

    updateIcon();
  });

  updateIcon();
});



/* ==========================================
   IMAGE VIEWER (lightbox)
========================================== */

const modal = document.getElementById("imgModal");
const modalImg = document.getElementById("imgModalPic");
const modalClose = document.querySelector(".img-close");


/* открыть */

document.addEventListener("click", e=>{
  if(e.target.matches(".post-card img")){
    modalImg.src = e.target.src;
    modal.classList.remove("hidden");
  }
});


/* закрыть */

modalClose.onclick = ()=> modal.classList.add("hidden");

modal.onclick = (e)=>{
  if(e.target===modal) modal.classList.add("hidden");
};

document.addEventListener("keydown", e=>{
  if(e.key==="Escape") modal.classList.add("hidden");
});




