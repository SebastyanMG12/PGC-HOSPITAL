// app.js
// Implementación local (localStorage) del sistema de pre-registro y paneles
// NOTA: para producción NO usar localStorage para credenciales. Aquí es demo.

(function(){
  /* ---------- Utilidades ---------- */
  const $ = (selector, ctx=document) => ctx.querySelector(selector);
  const $$ = (selector, ctx=document) => Array.from(ctx.querySelectorAll(selector));
  const uid = (prefix='id') => prefix + '-' + Math.random().toString(36).slice(2,9);
  const now = () => (new Date()).toISOString();
  const STORAGE_KEYS = {
    USERS: 'eseb_usuarios',
    PATIENTS: 'eseb_pacientes',
    SESSION: 'eseb_session'
  };

  // read / write
  function read(key){ try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){ return null; } }
  function write(key,val){ localStorage.setItem(key, JSON.stringify(val)); window.dispatchEvent(new Event('storage')); }

  // Inicializar estructuras si no existen
  if(!read(STORAGE_KEYS.USERS)) write(STORAGE_KEYS.USERS, []);
  if(!read(STORAGE_KEYS.PATIENTS)) write(STORAGE_KEYS.PATIENTS, []);

  // Simple "hash" demo (base64) - NO SEGURO
  function encodePassword(p){ return btoa(p); }
  function checkPassword(stored, plain){ return stored === encodePassword(plain); }

  /* ---------- Elementos ---------- */
  const formRegister = $('#form-register');
  const registerResult = $('#register-result');
  const btnOpenLoginMed = $('#open-login-med');
  const btnOpenLoginAdmin = $('#open-login-admin');
  const modalLogin = $('#modal-login');
  const formLogin = $('#form-login');
  const formCreateUser = $('#form-create-user');
  const panelStaff = $('#panel-staff');
  const panelTitle = $('#panel-title');
  const patientListEl = $('#patient-list');
  const patientDetailEl = $('#patient-detail');
  const btnLogout = $('#btn-logout');
  const searchInput = $('#search-patient');
  const btnSearch = $('#btn-search');

  const btnOpenCompanion = $('#open-companion');
  const panelCompanion = $('#panel-companion');
  const formCompanion = $('#form-companion');
  const companionResult = $('#companion-result');

  /* ---------- Funciones de Usuarios ---------- */
  function getUsers(){ return read(STORAGE_KEYS.USERS) || []; }
  function saveUser(username,password,role){
    const users = getUsers();
    if(users.some(u=>u.username===username)) throw new Error('Usuario ya existe');
    users.push({ id: uid('user'), username, password: encodePassword(password), role, created: now() });
    write(STORAGE_KEYS.USERS, users);
    return true;
  }
  function loginUser(username,password,role){
    const users = getUsers();
    const u = users.find(x=>x.username===username && x.role===role);
    if(!u) return null;
    if(!checkPassword(u.password,password)) return null;
    // session
    write(STORAGE_KEYS.SESSION, { userId: u.id, username:u.username, role:u.role, loggedAt: now() });
    return u;
  }
  function logout(){
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    panelStaff.classList.add('hidden');
  }
  function currentSession(){ return read(STORAGE_KEYS.SESSION); }

  /* ---------- Pacientes ---------- */
  function getPatients(){ return read(STORAGE_KEYS.PATIENTS) || []; }
  function savePatients(list){ write(STORAGE_KEYS.PATIENTS, list); }
  function createPatient(data){
    // Generamos dos códigos:
    // - internalId (solo visible a staff)
    // - publicCode (para acompañantes)
    const internalId = uid('PINT');
    const publicCode = Math.random().toString(36).substr(2,7).toUpperCase();
    const patient = {
      id: uid('patient'),
      internalId,
      publicCode,
      name: data.name,
      doc: data.doc || null,
      phone: data.phone || null,
      reason: data.reason || '',
      notes: data.notes || '',
      createdAt: now(),
      arrived: false,
      arrivedAt: null,
      assignedRoom: null,
      assignedBed: null,
      attending: null,
      admittedAt: null,
      dischargedAt: null,
      procedures: [] // [{id,desc, performedBy, time}]
    };
    const patients = getPatients();
    patients.unshift(patient);
    savePatients(patients);
    return patient;
  }
  function updatePatient(id, patch){
    const patients = getPatients();
    const idx = patients.findIndex(p=>p.id===id);
    if(idx===-1) throw new Error('Paciente no encontrado');
    patients[idx] = Object.assign({}, patients[idx], patch);
    savePatients(patients);
    return patients[idx];
  }

  // --- CORRECCIÓN IMPORTANTE: addProcedure ahora actualiza correctamente, persiste y refresca UI ---
  function addProcedure(patientId, desc, performedBy){
    const patients = getPatients();
    const p = patients.find(x=>x.id===patientId);
    if(!p) throw new Error('Paciente no encontrado');
    const proc = { id: uid('proc'), desc, performedBy, time: now() };
    p.procedures = p.procedures || [];
    p.procedures.unshift(proc);
    // Guardar el array completo de pacientes de forma explícita
    write(STORAGE_KEYS.PATIENTS, patients);

    // REFRESCAR UI: lista y detalle (si están abiertos) y actualizar panel acompañante si aplica
    try {
      renderPatientList(searchInput.value.trim());
    } catch(e){ /* safe */ }

    // Si el detalle del paciente está abierto y corresponde a este paciente, re-renderizarlo
    try {
      const detailH3 = patientDetailEl.querySelector('h3');
      if(detailH3 && detailH3.textContent === p.name){
        showPatientDetail(p.id);
      }
    } catch(e){ /* safe */ }

    // Si el panel de acompañante está abierto y el código coincide, actualizarlo
    try {
      const compCodeInput = $('#comp-code');
      if(compCodeInput && !panelCompanion.classList.contains('hidden') && compCodeInput.value.trim() === p.publicCode){
        showCompanion(p.publicCode);
      }
    } catch(e){ /* safe */ }

    // Disparar evento para otras pestañas (ya lo hace write con dispatchEvent('storage'))
    return proc;
  }

  /* ---------- Render lista pacientes (staff) ---------- */
  function renderPatientList(filter=''){
    const list = getPatients().filter(p=>{
      if(!filter) return true;
      const f = filter.toLowerCase();
      return (p.name && p.name.toLowerCase().includes(f)) ||
             (p.internalId && p.internalId.toLowerCase().includes(f)) ||
             (p.publicCode && p.publicCode.toLowerCase().includes(f));
    });
    patientListEl.innerHTML = '';
    if(list.length===0){
      patientListEl.innerHTML = '<div class="muted">No hay pacientes registrados</div>';
      return;
    }
    list.forEach(p=>{
      const div = document.createElement('div');
      div.className = 'patient-item';
      div.innerHTML = `<div>
                        <strong>${p.name}</strong><br>
                        <small>${p.reason || ''} · ${p.phone || ''}</small>
                       </div>
                       <div style="text-align:right">
                         <small>Public: ${p.publicCode}</small><br>
                         <small>Creado: ${new Date(p.createdAt).toLocaleString()}</small>
                       </div>`;
      div.addEventListener('click', ()=> showPatientDetail(p.id));
      patientListEl.appendChild(div);
    });
  }

  /* ---------- Mostrar detalle paciente (según rol) ---------- */
  function showPatientDetail(patientId){
    const session = currentSession();
    const role = session ? session.role : null;
    const p = getPatients().find(x=>x.id===patientId);
    if(!p) { patientDetailEl.innerHTML = '<div class="muted">Paciente no encontrado</div>'; return; }

    // detalle visible
    let html = `<div>
      <div class="detail-card">
        <h3>${p.name}</h3>
        <div class="detail-grid">
          <div class="kv"><strong>Creado</strong><div class="muted">${new Date(p.createdAt).toLocaleString()}</div></div>
          <div class="kv"><strong>Código público</strong><div class="muted">${p.publicCode}</div></div>
          <div class="kv"><strong>Teléfono</strong><div class="muted">${p.phone || '-'}</div></div>
          <div class="kv"><strong>Motivo</strong><div class="muted">${p.reason || '-'}</div></div>
          <div class="kv"><strong>Notas</strong><div class="muted">${p.notes || '-'}</div></div>
        </div>`;

    // Campos sensibles solo para staff/admin
    if(role === 'medico' || role === 'admin'){
      html += `<div style="margin-top:12px">
        <div class="detail-grid">
          <div class="kv"><strong>Internal ID</strong><div class="muted">${p.internalId}</div></div>
          <div class="kv"><strong>Documento</strong><div class="muted">${p.doc || '-'}</div></div>
          <div class="kv"><strong>Llegada</strong><div class="muted">${p.arrived ? 'Confirmada '+ new Date(p.arrivedAt).toLocaleString() : 'Pendiente'}</div></div>
          <div class="kv"><strong>Hab / Camilla</strong><div class="muted">${p.assignedRoom || '-'} / ${p.assignedBed || '-'}</div></div>
          <div class="kv"><strong>Atiende</strong><div class="muted">${p.attending || '-'}</div></div>
          <div class="kv"><strong>Ingreso</strong><div class="muted">${p.admittedAt ? new Date(p.admittedAt).toLocaleString() : '-'}</div></div>
          <div class="kv"><strong>Egreso</strong><div class="muted">${p.dischargedAt ? new Date(p.dischargedAt).toLocaleString() : '-'}</div></div>
        </div>
        </div>`;
    }

    // Actions (staff)
    if(role === 'medico' || role === 'admin'){
      html += `<div style="margin-top:10px" class="detail-card">
        <strong>Acciones</strong>
        <div style="margin-top:8px" class="row">
          <button class="btn primary" id="btn-confirm-arrival">${p.arrived ? 'Llegada confirmada' : 'Confirmar llegada'}</button>
          <button class="btn" id="btn-assign-room">Asignar Hab/Cam</button>
          <button class="btn" id="btn-set-attending">Asignar personal</button>
          <button class="btn ghost" id="btn-set-admit">Marcar ingreso</button>
          <button class="btn ghost" id="btn-set-discharge">Marcar egreso</button>
        </div>
        <hr />
        <div>
          <h4>Agregar procedimiento / nota de atención</h4>
          <input id="inp-proc-desc" placeholder="Descripción del procedimiento / orden" />
          <input id="inp-proc-by" placeholder="Realizado por (nombre)" />
          <div style="margin-top:8px">
            <button class="btn primary" id="btn-add-proc">Agregar</button>
          </div>
        </div>
      </div>`;
    }

    // Procedimientos (visibles para todos que tengan access)
    html += `<div class="timeline"><h4>Historial de procedimientos</h4>`;
    if(!p.procedures || p.procedures.length===0) html += `<div class="muted">Sin procedimientos registrados</div>`;
    (p.procedures || []).forEach(pr=>{
      html += `<div class="proc"><strong>${pr.desc}</strong><small>${pr.performedBy || '---'} · ${new Date(pr.time).toLocaleString()}</small></div>`;
    });
    html += `</div></div>`;

    patientDetailEl.innerHTML = html;

    // Enlazar botones
    if(role === 'medico' || role === 'admin'){
      $('#btn-confirm-arrival').addEventListener('click', ()=>{
        updatePatient(p.id, {
          arrived: true,
          arrivedAt: (!p.arrivedAt ? now() : p.arrivedAt)
        });
        renderPatientList(searchInput.value);
        showPatientDetail(p.id);
      });

      $('#btn-assign-room').addEventListener('click', ()=>{
        const r = prompt('Número de habitación / sala (ej: 201A):', p.assignedRoom || '');
        const b = prompt('Número de camilla:', p.assignedBed || '');
        updatePatient(p.id, { assignedRoom: r || null, assignedBed: b || null });
        showPatientDetail(p.id);
      });

      $('#btn-set-attending').addEventListener('click', ()=>{
        const name = prompt('Nombre del personal que atiende:', p.attending || '');
        updatePatient(p.id, { attending: name || null });
        showPatientDetail(p.id);
      });

      $('#btn-set-admit').addEventListener('click', ()=>{
        updatePatient(p.id, { admittedAt: now() });
        showPatientDetail(p.id);
      });

      $('#btn-set-discharge').addEventListener('click', ()=>{
        updatePatient(p.id, { dischargedAt: now() });
        showPatientDetail(p.id);
      });

      $('#btn-add-proc').addEventListener('click', ()=>{
        const desc = $('#inp-proc-desc').value.trim();
        const by = $('#inp-proc-by').value.trim() || (currentSession() ? currentSession().username : 'staff');
        if(!desc) return alert('Describe el procedimiento');
        addProcedure(p.id, desc, by);
        $('#inp-proc-desc').value = '';
        $('#inp-proc-by').value = '';
        // showPatientDetail(p.id); // ya hace addProcedure internamente la actualización
      });
    }
  }

  /* ---------- Public registro ---------- */
  formRegister.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const name = $('#p_name').value.trim();
    const doc = $('#p_doc').value.trim();
    const phone = $('#p_phone').value.trim();
    const reason = $('#p_reason').value.trim();
    const notes = $('#p_notes').value.trim();

    if(!name || !reason) { alert('Nombre y motivo son requeridos'); return; }
    const patient = createPatient({ name, doc, phone, reason, notes });
    registerResult.innerHTML = `<strong>Registro recibido</strong>. Código público: <code>${patient.publicCode}</code> . Si deseas compartirlo con un acompañante, dale ese código.`;
    formRegister.reset();
    renderPatientList(); // actualiza lista staff si está abierta
  });

  $('#btn-clear').addEventListener('click', ()=> formRegister.reset());

  /* ---------- Login / create user ---------- */
  btnOpenLoginMed.addEventListener('click', ()=> openLoginModal('medico'));
  btnOpenLoginAdmin.addEventListener('click', ()=> openLoginModal('admin'));
  function openLoginModal(role){
    modalLogin.classList.remove('hidden');
    $('#login-role').value = role;
    $('#login-title').textContent = role === 'medico' ? 'Login - Personal Médico' : 'Login - Administración';
  }
  $('#btn-cancel-login').addEventListener('click', ()=> modalLogin.classList.add('hidden'));

  formCreateUser.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const u = $('#new-username').value.trim();
    const p = $('#new-password').value.trim();
    const r = $('#new-role').value;
    try{
      saveUser(u,p,r);
      alert('Usuario creado localmente. Úsalo para iniciar sesión.');
      $('#new-username').value=''; $('#new-password').value='';
      renderPatientList();
    }catch(e){
      alert(e.message);
    }
  });

  formLogin.addEventListener('submit',(ev)=>{
    ev.preventDefault();
    const u = $('#login-username').value.trim();
    const p = $('#login-password').value.trim();
    const r = $('#login-role').value;
    const user = loginUser(u,p,r);
    if(!user){ alert('Credenciales inválidas'); return; }
    modalLogin.classList.add('hidden');
    openStaffPanel(user);
  });

  function openStaffPanel(user){
    panelTitle.textContent = user.role === 'medico' ? `Panel Médico - ${user.username}` : `Panel Administración - ${user.username}`;
    panelStaff.classList.remove('hidden');
    renderPatientList();
    patientDetailEl.innerHTML = `<div class="muted">Selecciona un paciente para ver detalles</div>`;
  }

  btnLogout.addEventListener('click', ()=>{
    logout();
    modalLogin.classList.remove('hidden');
  });

  btnSearch.addEventListener('click', ()=> renderPatientList(searchInput.value.trim()));
  searchInput.addEventListener('keydown', (e)=> { if(e.key==='Enter') renderPatientList(searchInput.value.trim()); });

  /* ---------- Companion panel ---------- */
  btnOpenCompanion.addEventListener('click', ()=> panelCompanion.classList.remove('hidden'));
  $('#btn-close-companion').addEventListener('click', ()=> panelCompanion.classList.add('hidden'));

  formCompanion.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const code = $('#comp-code').value.trim();
    if(!code) return;
    showCompanion(code);
  });

  function showCompanion(code){
    const p = getPatients().find(x=>x.publicCode === code);
    if(!p){ companionResult.innerHTML = `<div class="muted">Código no encontrado</div>`; return; }
    // Mostrar información permitida: nombre, motivo, estado de llegada, procedimientos (sin doc ni internalId)
    let html = `<div class="detail-card"><h3>${p.name}</h3>
      <div class="detail-grid">
        <div class="kv"><strong>Motivo</strong><div class="muted">${p.reason || '-'}</div></div>
        <div class="kv"><strong>Teléfono</strong><div class="muted">${p.phone || '-'}</div></div>
        <div class="kv"><strong>Llegada</strong><div class="muted">${p.arrived ? 'Confirmada '+ new Date(p.arrivedAt).toLocaleString() : 'Pendiente'}</div></div>
        <div class="kv"><strong>Hab / Camilla</strong><div class="muted">${p.assignedRoom || '-'} / ${p.assignedBed || '-'}</div></div>
        <div class="kv"><strong>Atiende</strong><div class="muted">${p.attending || '-'}</div></div>
      </div>
      <div class="timeline"><h4>Procedimientos (tiempo real)</h4>`;
    if(p.procedures.length===0) html += `<div class="muted">Sin procedimientos registrados</div>`;
    p.procedures.forEach(pr=>{
      html += `<div class="proc"><strong>${pr.desc}</strong><small>${pr.performedBy || '---'} · ${new Date(pr.time).toLocaleString()}</small></div>`;
    });
    html += `</div></div>`;
    companionResult.innerHTML = html;
  }

  /* ---------- Storage listener (para "tiempo real") ---------- */
  window.addEventListener('storage', ()=>{
    // Si panel companion está visible y tiene código, actualizarlo
    if(!panelCompanion.classList.contains('hidden')){
      const code = $('#comp-code').value.trim();
      if(code) showCompanion(code);
    }
    // Si panel staff está abierto, actualizar lista y detalle actuales
    if(!panelStaff.classList.contains('hidden')){
      renderPatientList(searchInput.value.trim());
      // si hay detalle visible, re-render it
      const detail = patientDetailEl.querySelector('h3');
      if(detail){
        const name = detail.textContent;
        const p = getPatients().find(x=>x.name === name);
        if(p) showPatientDetail(p.id);
      }
    }
  });

  // cuando se carga página, si hay sesión, abrir panel staff
  (function init(){
    const sess = currentSession();
    if(sess) {
      openStaffPanel(sess);
    }
    renderPatientList();
  })();

  // Export / import utilities (opcional)
  window.__eseb = {
    getPatients, getUsers: getUsers, exportData: ()=> {
      return { users:getUsers(), patients:getPatients() };
    },
    importData: (obj)=> {
      if(obj.users) write(STORAGE_KEYS.USERS, obj.users);
      if(obj.patients) write(STORAGE_KEYS.PATIENTS, obj.patients);
      alert('Datos importados localmente');
      renderPatientList();
    }
  };

})();
