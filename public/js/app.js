// ---------- State ----------
const state = {
  page: 1,
  limit: 10,
  search: '',
  course: '',
  year: '',
  editingId: null, // null = adding a new student
  deletingId: null,
  viewingId: null,
  listRequest: 0, // used to ignore out-of-date responses while typing in search
};

// ---------- DOM ----------
const $ = (sel) => document.querySelector(sel);
const els = {
  stats: $('#stats'),
  rows: $('#student-rows'),
  tableWrap: $('.table-wrap'),
  state: $('#state'),
  count: $('#result-count'),
  pagination: $('#pagination'),
  pageInfo: $('#page-info'),
  prev: $('#prev-page'),
  next: $('#next-page'),
  search: $('#search'),
  courseFilter: $('#course-filter'),
  yearFilter: $('#year-filter'),
  formModal: $('#form-modal'),
  form: $('#student-form'),
  formTitle: $('#form-title'),
  saveBtn: $('#save-btn'),
  detailsModal: $('#details-modal'),
  detailsBody: $('#details-body'),
  confirmModal: $('#confirm-modal'),
  confirmText: $('#confirm-text'),
  confirmBtn: $('#confirm-delete'),
  toasts: $('#toasts'),
};

// ---------- Helpers ----------
// Escape user-entered text before putting it into HTML (prevents XSS)
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Dates are stored as UTC midnight; format in UTC so the day never shifts
const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

function toast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  els.toasts.appendChild(el);
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 300); }, 3500);
}

function fillSelect(select, values, keepFirst = true) {
  const first = keepFirst ? select.options[0].outerHTML : '';
  select.innerHTML = first + values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

// ---------- Stats ----------
async function loadStats() {
  try {
    const { total, byCourse } = await api.getStats();
    els.stats.innerHTML =
      `<div class="stat-card stat-total"><span class="stat-label">Total Students</span><span class="stat-value">${total}</span></div>` +
      byCourse
        .map((c) => `<div class="stat-card"><span class="stat-label">${escapeHtml(c.course)}</span><span class="stat-value">${c.count}</span></div>`)
        .join('');
  } catch {
    // The list shows its own error state; stats just stay as they were
  }
}

// ---------- List ----------
function showState(kind, message) {
  els.tableWrap.hidden = kind !== 'table';
  els.state.hidden = kind === 'table';
  els.pagination.hidden = kind !== 'table';
  if (kind === 'loading') {
    els.state.innerHTML = '<div class="spinner" role="status" aria-label="Loading"></div><p class="muted" style="margin-top:12px">Loading students…</p>';
  } else if (kind === 'empty') {
    const filtered = state.search || state.course || state.year;
    els.state.innerHTML = filtered
      ? '<div class="state-icon" aria-hidden="true">🔍</div><h3>No matching students</h3><p class="muted">Try a different search or clear the filters.</p><button type="button" class="btn btn-ghost" data-action="clear-filters">Clear filters</button>'
      : '<div class="state-icon" aria-hidden="true">🎓</div><h3>No students yet</h3><p class="muted">Add your first student to get started.</p><button type="button" class="btn btn-primary" data-action="add">＋ Add Student</button>';
  } else if (kind === 'error') {
    els.state.innerHTML = `<div class="state-icon" aria-hidden="true">⚠️</div><h3>Couldn't load students</h3><p class="muted">${escapeHtml(message)}</p><button type="button" class="btn btn-ghost" data-action="retry">Try again</button>`;
  }
}

function renderRows(students) {
  els.rows.innerHTML = students
    .map(
      (s) => `
      <tr>
        <td data-label="Roll No." class="cell-roll">${escapeHtml(s.rollNumber)}</td>
        <td data-label="Name" class="cell-name">${escapeHtml(s.name)}</td>
        <td data-label="Email">${escapeHtml(s.email)}</td>
        <td data-label="Course"><span class="badge">${escapeHtml(s.course)}</span></td>
        <td data-label="Year">${s.year}</td>
        <td data-label="Phone">${escapeHtml(s.phone)}</td>
        <td class="actions">
          <button type="button" class="btn btn-ghost btn-sm" data-action="view" data-id="${s._id}" aria-label="View ${escapeHtml(s.name)}">View</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="${s._id}" aria-label="Edit ${escapeHtml(s.name)}">Edit</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="delete" data-id="${s._id}" data-name="${escapeHtml(s.name)}" aria-label="Delete ${escapeHtml(s.name)}">Delete</button>
        </td>
      </tr>`
    )
    .join('');
}

async function loadStudents() {
  const requestId = ++state.listRequest;
  showState('loading');
  els.count.textContent = '';

  const params = { page: state.page, limit: state.limit };
  if (state.search) params.search = state.search;
  if (state.course) params.course = state.course;
  if (state.year) params.year = state.year;

  try {
    const { data, pagination } = await api.listStudents(params);
    if (requestId !== state.listRequest) return; // a newer request has started

    // e.g. the last student on the last page was deleted: step back a page
    if (data.length === 0 && pagination.total > 0 && state.page > 1) {
      state.page = pagination.totalPages;
      return loadStudents();
    }

    if (data.length === 0) {
      showState('empty');
      return;
    }

    renderRows(data);
    showState('table');
    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = from + data.length - 1;
    els.count.textContent = `Showing ${from}–${to} of ${pagination.total} student${pagination.total === 1 ? '' : 's'}`;
    els.pageInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
    els.prev.disabled = pagination.page <= 1;
    els.next.disabled = pagination.page >= pagination.totalPages;
    els.pagination.hidden = pagination.totalPages <= 1;
  } catch (err) {
    if (requestId !== state.listRequest) return;
    showState('error', err.message);
  }
}

const refresh = () => Promise.all([loadStudents(), loadStats()]);

// ---------- Add / Edit form ----------
function clearFormErrors() {
  els.form.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
  els.form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}

function showFormErrors(errors) {
  let first;
  for (const [field, message] of Object.entries(errors)) {
    const slot = els.form.querySelector(`[data-error-for="${field}"]`);
    const input = els.form.elements[field];
    if (slot) slot.textContent = message;
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      first ??= input;
    }
  }
  first?.focus();
}

// Quick checks in the browser for instant feedback. The server validates everything again.
function validateForm(data) {
  const errors = {};
  if (!data.name || data.name.length < 2) errors.name = 'Name must be at least 2 characters';
  if (!data.rollNumber) errors.rollNumber = 'Roll number is required';
  else if (!/^[A-Za-z0-9-]{3,20}$/.test(data.rollNumber)) errors.rollNumber = 'Letters, digits and "-" only (3–20 characters)';
  if (!data.email) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Please enter a valid email address';
  if (!data.phone) errors.phone = 'Phone number is required';
  else if (!/^\+?[0-9 ]{7,15}$/.test(data.phone)) errors.phone = 'Phone must be 7–15 digits, optionally starting with +';
  if (!data.course) errors.course = 'Course is required';
  if (!data.year) errors.year = 'Year is required';
  if (!data.gender) errors.gender = 'Gender is required';
  if (data.dateOfBirth && new Date(data.dateOfBirth) >= new Date()) errors.dateOfBirth = 'Date of birth must be in the past';
  return errors;
}

function readForm() {
  const data = Object.fromEntries(new FormData(els.form));
  for (const key of Object.keys(data)) data[key] = data[key].trim();
  return data;
}

function openForm(student = null) {
  state.editingId = student?._id ?? null;
  els.form.reset();
  clearFormErrors();
  els.formTitle.textContent = student ? 'Edit Student' : 'Add Student';
  els.saveBtn.textContent = student ? 'Save changes' : 'Add student';

  if (student) {
    for (const field of ['name', 'rollNumber', 'email', 'phone', 'course', 'year', 'gender', 'address']) {
      els.form.elements[field].value = student[field] ?? '';
    }
    els.form.elements.dateOfBirth.value = student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '';
  }
  els.formModal.showModal();
  els.form.elements.name.focus();
}

async function submitForm(e) {
  e.preventDefault();
  clearFormErrors();
  const data = readForm();
  const errors = validateForm(data);
  if (Object.keys(errors).length) return showFormErrors(errors);

  els.saveBtn.disabled = true;
  const label = els.saveBtn.textContent;
  els.saveBtn.textContent = 'Saving…';
  try {
    if (state.editingId) {
      await api.updateStudent(state.editingId, data);
      toast(`${data.name} updated`);
    } else {
      await api.createStudent(data);
      toast(`${data.name} added`);
      state.page = 1; // new students appear first (sorted by newest)
    }
    els.formModal.close();
    refresh();
  } catch (err) {
    // 400 / 409: show the server's message next to the right field
    if (Object.keys(err.errors).length) showFormErrors(err.errors);
    toast(err.message, 'error');
  } finally {
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = label;
  }
}

// ---------- View details ----------
async function openDetails(id) {
  try {
    const { data: s } = await api.getStudent(id);
    state.viewingId = s._id;
    const rows = [
      ['Name', s.name],
      ['Roll number', s.rollNumber],
      ['Email', s.email],
      ['Phone', s.phone],
      ['Course', s.course],
      ['Year', s.year],
      ['Gender', s.gender],
      ['Date of birth', formatDate(s.dateOfBirth)],
      ['Address', s.address || '—'],
      ['Added on', formatDate(s.createdAt)],
    ];
    els.detailsBody.innerHTML =
      '<dl class="details">' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join('') + '</dl>';
    els.detailsModal.showModal();
  } catch (err) {
    toast(err.message, 'error');
    if (err.status === 404) refresh();
  }
}

// ---------- Delete ----------
function openConfirm(id, name) {
  state.deletingId = id;
  els.confirmText.innerHTML = `This will permanently delete <strong>${escapeHtml(name)}</strong>. This can't be undone.`;
  els.confirmModal.showModal();
}

async function confirmDelete() {
  els.confirmBtn.disabled = true;
  els.confirmBtn.textContent = 'Deleting…';
  try {
    await api.deleteStudent(state.deletingId);
    toast('Student deleted');
    els.confirmModal.close();
    refresh();
  } catch (err) {
    toast(err.message, 'error');
    if (err.status === 404) { els.confirmModal.close(); refresh(); }
  } finally {
    els.confirmBtn.disabled = false;
    els.confirmBtn.textContent = 'Delete';
  }
}

// ---------- Events ----------
$('#add-btn').addEventListener('click', () => openForm());
els.form.addEventListener('submit', submitForm);
els.confirmBtn.addEventListener('click', confirmDelete);
$('#details-edit').addEventListener('click', async () => {
  els.detailsModal.close();
  try {
    const { data } = await api.getStudent(state.viewingId);
    openForm(data);
  } catch (err) {
    toast(err.message, 'error');
  }
});

// Clear a field's error as soon as the user edits it
els.form.addEventListener('input', (e) => {
  if (e.target.name) {
    e.target.removeAttribute('aria-invalid');
    const slot = els.form.querySelector(`[data-error-for="${e.target.name}"]`);
    if (slot) slot.textContent = '';
  }
});

// Close buttons and clicks on the dark backdrop close any modal
document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || e.target === dialog) dialog.close();
  });
});

// One listener handles the buttons in every table row and in the empty/error states
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'view') openDetails(id);
  if (action === 'delete') openConfirm(id, btn.dataset.name);
  if (action === 'add') openForm();
  if (action === 'retry') refresh();
  if (action === 'clear-filters') {
    state.search = state.course = state.year = '';
    els.search.value = els.courseFilter.value = els.yearFilter.value = '';
    state.page = 1;
    loadStudents();
  }
  if (action === 'edit') {
    try {
      const { data } = await api.getStudent(id);
      openForm(data);
    } catch (err) {
      toast(err.message, 'error');
    }
  }
});

els.search.addEventListener('input', debounce(() => {
  state.search = els.search.value.trim();
  state.page = 1;
  loadStudents();
}, 300));
els.courseFilter.addEventListener('change', () => { state.course = els.courseFilter.value; state.page = 1; loadStudents(); });
els.yearFilter.addEventListener('change', () => { state.year = els.yearFilter.value; state.page = 1; loadStudents(); });
els.prev.addEventListener('click', () => { state.page--; loadStudents(); });
els.next.addEventListener('click', () => { state.page++; loadStudents(); });

// ---------- Start ----------
(async function init() {
  try {
    const { courses, genders } = await api.getMeta();
    fillSelect(els.courseFilter, courses);
    fillSelect(els.form.elements.course, courses);
    fillSelect(els.form.elements.gender, genders);
  } catch (err) {
    toast("Couldn't load course list: " + err.message, 'error');
  }
  refresh();
})();
