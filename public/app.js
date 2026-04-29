/* ── Toast ──────────────────────────────────────────────────────────────────── */
function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ── Modal helpers ──────────────────────────────────────────────────────────── */
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
});

/* ═══════════════════════════════════════════════════════════════════════════════
   SCHEDULE PAGE
   ══════════════════════════════════════════════════════════════════════════════*/

/* ── Period selector ─────────────────────────────────────────────────────────── */
const periodSelect = document.getElementById('period-select');
if (periodSelect) {
  periodSelect.addEventListener('change', () => {
    window.location.href = '/?period=' + periodSelect.value;
  });
}

/* ── Refresh button ──────────────────────────────────────────────────────────── */
const refreshBtn = document.getElementById('refresh-btn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    const id = periodSelect ? periodSelect.value : null;
    if (id) window.location.href = '/?period=' + id;
    else window.location.reload();
  });
}

/* ── Cell toggle (mark complete / undo) ─────────────────────────────────────── */
document.addEventListener('click', async e => {
  const btn = e.target.closest('.cell-btn[data-assignment-id]');
  if (!btn || btn.dataset.isFuture === 'true') return;

  btn.disabled = true;
  const spinner = document.createElement('div');
  spinner.className = 'spinner spinner-sm';
  const origInner = btn.innerHTML;
  btn.innerHTML = '';
  btn.appendChild(spinner);

  try {
    await fetch('/api/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignment_id: Number(btn.dataset.assignmentId),
        week_date: btn.dataset.weekDate,
        undo: btn.dataset.isComplete === 'true',
      }),
    });
    // Reload page to reflect updated state
    const periodId = periodSelect ? periodSelect.value : window.OFD_PERIOD_ID;
    window.location.href = '/?period=' + periodId;
  } catch {
    btn.innerHTML = origInner;
    btn.disabled = false;
    showToast('Failed to update completion', 'error');
  }
});

/* ── Notify modal ────────────────────────────────────────────────────────────── */
let _notifyWeek = null;
let _notifyAssignmentId = null;

async function openNotify(week, assignmentId) {
  _notifyWeek = week;
  _notifyAssignmentId = assignmentId || null;

  const modal = document.getElementById('notify-modal');
  const label = document.getElementById('notify-week-label');
  const loading = document.getElementById('notify-loading');
  const content = document.getElementById('notify-content');
  const footer = document.getElementById('notify-footer');

  if (label) label.textContent = 'Week of ' + fmtDateLong(week);

  modal.classList.remove('hidden');
  loading.classList.remove('hidden');
  content.classList.add('hidden');
  if (footer) footer.classList.add('hidden');

  const periodId = window.OFD_PERIOD_ID;
  if (!periodId) return;

  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_id: periodId,
        week_date: week,
        target: _notifyAssignmentId ?? 'pending',
        dry_run: true,
      }),
    });
    const data = await res.json();
    renderNotifyRecipients(data.recipients || []);
  } catch {
    content.innerHTML = '<p class="text-muted">Failed to load recipients.</p>';
  } finally {
    loading.classList.add('hidden');
    content.classList.remove('hidden');
  }
}

function renderNotifyRecipients(recipients) {
  const content = document.getElementById('notify-content');
  const footer  = document.getElementById('notify-footer');
  const sendBtn = document.getElementById('notify-send-btn');

  if (!recipients || recipients.length === 0) {
    content.innerHTML = `
      <div style="text-align:center;padding:32px">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" style="margin:0 auto 8px;display:block"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
        <p style="font-weight:600">All checks complete for this week!</p>
      </div>`;
    if (footer) footer.classList.add('hidden');
    return;
  }

  const withEmail = recipients.filter(r => r.email).length;
  let html = `<p class="text-muted text-sm mb-2">${recipients.length} member${recipients.length !== 1 ? 's' : ''} pending:</p>`;
  for (const r of recipients) {
    html += `<div class="recipient-card">
      <div>
        <div class="name">${esc(r.name)}</div>
        <div class="slot">${esc(r.slot)}</div>
        ${r.email
          ? `<div class="email">${esc(r.email)}</div>`
          : `<div class="no-email">⚠ No email on file</div>`}
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${r.email ? 'var(--border-light)' : 'var(--warning)'}" stroke-width="2" style="flex-shrink:0;margin-top:2px"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
    </div>`;
  }
  content.innerHTML = html;

  if (footer && sendBtn) {
    footer.classList.remove('hidden');
    sendBtn.textContent = '';
    sendBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Send ${withEmail} Email${withEmail !== 1 ? 's' : ''}`;
  }
}

async function sendReminders() {
  const sendBtn = document.getElementById('notify-send-btn');
  const content = document.getElementById('notify-content');
  const footer  = document.getElementById('notify-footer');
  if (!sendBtn || !_notifyWeek) return;

  sendBtn.disabled = true;
  sendBtn.innerHTML = '<div class="spinner spinner-sm"></div> Sending…';

  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_id: window.OFD_PERIOD_ID,
        week_date: _notifyWeek,
        target: _notifyAssignmentId ?? 'pending',
        dry_run: false,
      }),
    });
    const data = await res.json();

    content.innerHTML = `
      <div style="text-align:center;padding:32px">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" style="margin:0 auto 8px;display:block"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
        <p style="font-weight:600">Reminders sent!</p>
        <p class="text-muted text-sm mt-1">
          <span style="color:var(--success);font-weight:600">${data.sent} sent</span>
          ${data.failed > 0 ? ` · <span style="color:var(--danger);font-weight:600">${data.failed} failed</span>` : ''}
        </p>
      </div>`;
    if (footer) footer.classList.add('hidden');
  } catch {
    showToast('Failed to send reminders', 'error');
    sendBtn.disabled = false;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MEMBERS PAGE
   ══════════════════════════════════════════════════════════════════════════════*/

function filterMembers() {
  const search = (document.getElementById('member-search')?.value || '').toLowerCase();
  const status = document.getElementById('member-status-filter')?.value || 'all';
  const rows = document.querySelectorAll('.member-row');

  let activeCount = 0, inactiveCount = 0;

  rows.forEach(row => {
    const matchSearch = !search ||
      row.dataset.name.includes(search) ||
      row.dataset.email.includes(search) ||
      row.dataset.line.includes(search);
    const matchStatus = status === 'all' || row.dataset.status === status;
    const visible = matchSearch && matchStatus;
    row.style.display = visible ? '' : 'none';
    if (visible) {
      if (row.dataset.active === '1') activeCount++;
      else inactiveCount++;
    }
  });

  const ac = document.getElementById('active-count');
  const ic = document.getElementById('inactive-count');
  if (ac) ac.textContent = `(${activeCount})`;
  if (ic) ic.textContent = `(${inactiveCount})`;
}

function openMemberModal(member) {
  const modal = document.getElementById('member-modal');
  const title = document.getElementById('member-modal-title');
  const saveBtn = document.getElementById('member-save-btn');
  if (!modal) return;

  document.getElementById('member-id').value = member ? member.id : '';
  document.getElementById('m-line').value   = member ? (member.line_number || '') : '';
  document.getElementById('m-name').value   = member ? member.name : '';
  document.getElementById('m-email').value  = member ? (member.email || '') : '';
  document.getElementById('m-status').value = member ? member.status : 'active';
  document.getElementById('m-remarks').value = member ? (member.remarks || '') : '';
  document.getElementById('m-active').checked = member ? member.active === 1 : true;

  const err = document.getElementById('member-error');
  if (err) err.classList.add('hidden');

  title.textContent = member ? 'Edit Member' : 'Add Member';
  saveBtn.textContent = member ? 'Save Changes' : 'Add Member';
  modal.classList.remove('hidden');
}

async function saveMember() {
  const id = document.getElementById('member-id').value;
  const name = document.getElementById('m-name').value.trim();
  if (!name) return;

  const saveBtn = document.getElementById('member-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const payload = {
    line_number: document.getElementById('m-line').value.trim() || null,
    name,
    email: document.getElementById('m-email').value.trim() || null,
    status: document.getElementById('m-status').value,
    remarks: document.getElementById('m-remarks').value.trim() || null,
    active: document.getElementById('m-active').checked ? 1 : 0,
  };

  const url = id ? `/api/members/${id}` : '/api/members';
  const method = id ? 'PATCH' : 'POST';

  try {
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    closeModal('member-modal');
    window.location.reload();
  } catch {
    showToast('Failed to save member', 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = id ? 'Save Changes' : 'Add Member';
  }
}

async function deleteMember(id, name) {
  if (!confirm(`Remove ${name} from the roster?`)) return;
  const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const d = await res.json();
    alert(d.error || 'Cannot delete this member.');
    return;
  }
  window.location.reload();
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SLOTS PAGE
   ══════════════════════════════════════════════════════════════════════════════*/

function openSlotModal(slot) {
  const modal = document.getElementById('slot-modal');
  const title = document.getElementById('slot-modal-title');
  const saveBtn = document.getElementById('slot-save-btn');
  if (!modal) return;

  document.getElementById('slot-id').value = slot ? slot.id : '';
  document.getElementById('s-apparatus').value = slot ? slot.apparatus_name : '';
  document.getElementById('s-type').value      = slot ? slot.slot_type : '';
  document.getElementById('s-oic').value       = slot ? (slot.oic_name || '') : '';
  document.getElementById('s-note').value      = slot ? (slot.rotation_note || '') : '';

  let labels = '';
  if (slot && slot.rotation_labels) {
    try { labels = JSON.parse(slot.rotation_labels).join(', '); } catch { labels = ''; }
  }
  document.getElementById('s-labels').value = labels;

  title.textContent = slot ? 'Edit Slot' : 'Add Slot';
  saveBtn.textContent = slot ? 'Save Changes' : 'Add Slot';
  modal.classList.remove('hidden');
}

async function saveSlot() {
  const id = document.getElementById('slot-id').value;
  const apparatus = document.getElementById('s-apparatus').value.trim();
  const type = document.getElementById('s-type').value.trim();
  if (!apparatus || !type) return;

  const saveBtn = document.getElementById('slot-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const labelsStr = document.getElementById('s-labels').value.trim();
  const labelsArr = labelsStr ? labelsStr.split(',').map(l => l.trim()).filter(Boolean) : null;

  const payload = {
    apparatus_name: apparatus,
    slot_type: type,
    rotation_note: document.getElementById('s-note').value.trim() || null,
    rotation_labels: labelsArr,
    oic_name: document.getElementById('s-oic').value.trim() || null,
  };

  const url = id ? `/api/slots/${id}` : '/api/slots';
  const method = id ? 'PATCH' : 'POST';

  try {
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    closeModal('slot-modal');
    window.location.reload();
  } catch {
    showToast('Failed to save slot', 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = id ? 'Save Changes' : 'Add Slot';
  }
}

async function deleteSlot(id, name) {
  if (!confirm(`Remove "${name}" slot?`)) return;
  await fetch(`/api/slots/${id}`, { method: 'DELETE' });
  window.location.reload();
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PERIOD DETAIL PAGE
   ══════════════════════════════════════════════════════════════════════════════*/

function onDetailAssignChange(select) {
  select.classList.toggle('unassigned', !select.value);
  checkUnassigned();
}

function checkUnassigned() {
  const selects = document.querySelectorAll('[data-slot-id]');
  const count = Array.from(selects).filter(s => !s.value).length;
  const alert = document.getElementById('unassigned-alert');
  const text  = document.getElementById('unassigned-text');
  if (!alert) return;
  if (count > 0) {
    text.textContent = `${count} slot${count > 1 ? 's are' : ' is'} unassigned`;
    alert.classList.remove('hidden');
  } else {
    alert.classList.add('hidden');
  }
}

async function savePeriodAssignments() {
  const btn = document.getElementById('save-btn');
  if (!btn || !window.PERIOD_ID) return;

  const selects = document.querySelectorAll('[data-slot-id]');
  const assignments = Array.from(selects).map(s => ({
    slot_id: Number(s.dataset.slotId),
    member_id: s.value ? Number(s.value) : null,
  }));

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div> Saving…';

  try {
    const res = await fetch(`/api/periods/${window.PERIOD_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: window.PERIOD_NAME,
        is_current: window.PERIOD_IS_CURRENT,
        assignments,
      }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    btn.className = 'btn btn-success';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg> Saved!`;
    showToast('Assignments saved', 'success');
    setTimeout(() => {
      btn.className = 'btn btn-primary';
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Assignments`;
      btn.disabled = false;
    }, 2500);
  } catch {
    showToast('Failed to save', 'error');
    btn.disabled = false;
    btn.className = 'btn btn-primary';
    btn.textContent = 'Save Assignments';
  }
}

// Init unassigned check on page load
if (document.querySelector('[data-slot-id]') && document.getElementById('save-btn')) {
  checkUnassigned();
}

/* ═══════════════════════════════════════════════════════════════════════════════
   NEW PERIOD PAGE
   ══════════════════════════════════════════════════════════════════════════════*/

// Date utilities (pure functions, no imports needed)
function _getSecondMonday(year, month) {
  const d = new Date(year, month, 1);
  const dow = d.getDay();
  const daysToFirst = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  d.setDate(1 + daysToFirst);
  d.setDate(d.getDate() + 7);
  return d;
}

function _getPeriodWeeks(startDate) {
  const start = new Date(startDate + 'T00:00:00');
  const ny = start.getMonth() === 11 ? start.getFullYear() + 1 : start.getFullYear();
  const nm = (start.getMonth() + 1) % 12;
  const next = _getSecondMonday(ny, nm);
  const weeks = [];
  const c = new Date(start);
  while (c < next) { weeks.push(c.toISOString().split('T')[0]); c.setDate(c.getDate() + 7); }
  return weeks;
}

function _getPeriodEndDate(startDate) {
  const w = _getPeriodWeeks(startDate);
  return w[w.length - 1] ?? startDate;
}

function fmtDateLong(d) {
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return d; }
}

function fmtDateShort(d) {
  try {
    const dt = new Date(d + 'T00:00:00');
    return (dt.getMonth()+1) + '/' + dt.getDate();
  } catch { return d; }
}

function onStartDateChange() {
  const sel = document.getElementById('period-start-date');
  if (!sel) return;
  const d = sel.value;
  if (!d) return;

  // Update name
  const nameEl = document.getElementById('period-name');
  if (nameEl) {
    const dt = new Date(d + 'T00:00:00');
    nameEl.value = dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  const weeks = _getPeriodWeeks(d);
  const end = _getPeriodEndDate(d);
  const preview = document.getElementById('date-range-preview');
  if (preview) {
    preview.style.display = 'flex';
    document.getElementById('pr-range').textContent =
      fmtDateLong(d) + ' – ' + fmtDateLong(end);
    document.getElementById('pr-weeks').textContent = weeks.length + ' weeks';
    document.getElementById('pr-mondays').textContent =
      'Mondays: ' + weeks.map(fmtDateShort).join(', ');
  }

  checkNewUnassigned();
}

function onAssignChange(select) {
  const prev = select.dataset.prevMember;
  const cur = select.value;
  select.classList.toggle('unassigned', !cur);
  select.classList.toggle('changed', cur !== prev && !!prev);
  checkNewUnassigned();
}

function checkNewUnassigned() {
  const selects = document.querySelectorAll('[data-slot-id]');
  const count = Array.from(selects).filter(s => !s.value).length;
  const alert = document.getElementById('unassigned-alert');
  const text  = document.getElementById('unassigned-text');
  if (!alert) return;
  if (count > 0) {
    text.textContent = `${count} slot${count > 1 ? 's' : ''} still unassigned`;
    alert.classList.remove('hidden');
  } else {
    alert.classList.add('hidden');
  }
}

async function createPeriod() {
  const name = document.getElementById('period-name')?.value?.trim();
  const startDate = document.getElementById('period-start-date')?.value;
  if (!name || !startDate) return;

  const btn = document.getElementById('create-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div> Creating…';

  const weeks = _getPeriodWeeks(startDate);
  const selects = document.querySelectorAll('[data-slot-id]');
  const assignments = Array.from(selects).map(s => ({
    slot_id: Number(s.dataset.slotId),
    member_id: s.value ? Number(s.value) : null,
  }));

  try {
    const res = await fetch('/api/periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, start_date: startDate, week_count: weeks.length, assignments }),
    });
    const period = await res.json();
    window.location.href = '/periods/' + period.id;
  } catch {
    showToast('Failed to create period', 'error');
    btn.disabled = false;
    btn.textContent = 'Create Period & Set as Current';
  }
}

// Init new-period page
const startDateSel = document.getElementById('period-start-date');
if (startDateSel) {
  onStartDateChange(); // run once on load
}

/* ── Settings ────────────────────────────────────────────────────────────── */

async function saveSettings() {
  const data = {};
  document.querySelectorAll('[data-setting-key]').forEach(el => {
    data[el.dataset.settingKey] = el.value;
  });
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    showToast('Settings saved', 'success');
  } catch (e) {
    showToast('Failed to save settings', 'error');
  }
}

async function autoGeneratePeriods() {
  const monthsInput = document.querySelector('[data-setting-key="auto_schedule_months"]');
  const months = monthsInput ? monthsInput.value : '6';
  try {
    const res = await fetch('/api/periods/auto-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ months: Number(months) }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    if (data.created === 0) {
      showToast(data.message || 'All periods already exist', 'info');
    } else {
      showToast(`Created ${data.created} period${data.created !== 1 ? 's' : ''}`, 'success');
      setTimeout(() => location.reload(), 1200);
    }
  } catch (e) {
    showToast('Failed to generate periods', 'error');
  }
}

function copyCronUrl() {
  const el = document.getElementById('cron-url');
  if (!el) return;
  navigator.clipboard.writeText(el.textContent.trim()).then(() => {
    showToast('Cron URL copied', 'success');
  });
}

/* ── Utility ─────────────────────────────────────────────────────────────── */
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
