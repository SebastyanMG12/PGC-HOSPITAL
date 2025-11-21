// app.js
// Implementación local (localStorage) del sistema de pre-registro y paneles
// NOTA: para producción NO usar localStorage para credenciales. Aquí es demo.

(function(){
  /* ---------- Utilidades ---------- */
  const $ = (selector, ctx=document) => ctx.querySelector(selector);
  const $$ = (selector, ctx=document) => Array.from((ctx || document).querySelectorAll(selector));
  const uid = (prefix='id') => prefix + '-' + Math.random().toString(36).slice(2,9);
  const now = () => (new Date()).toISOString();
  const STORAGE_KEYS = {
    USERS: 'eseb_usuarios',
    PATIENTS: 'eseb_pacientes',
    SESSION: 'eseb_session',
    ROOMS: 'eseb_rooms',
    DOCTORS: 'eseb_doctors',
    AUDIT: 'eseb_audit'
  };

  // read / write
  function read(key){ try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){ return null; } }
  function write(key,val){ localStorage.setItem(key, JSON.stringify(val)); window.dispatchEvent(new Event('storage')); }

  // Inicializar estructuras si no existen
  if(!read(STORAGE_KEYS.USERS)) write(STORAGE_KEYS.USERS, []);
  if(!read(STORAGE_KEYS.PATIENTS)) write(STORAGE_KEYS.PATIENTS, []);
  if(!read(STORAGE_KEYS.ROOMS)) initializeRooms();
  if(!read(STORAGE_KEYS.DOCTORS)) initializeDoctors();
  if(!read(STORAGE_KEYS.AUDIT)) write(STORAGE_KEYS.AUDIT, []);

  // Simple "hash" demo (base64) - NO SEGURO
  function encodePassword(p){ return btoa(p); }
  function checkPassword(stored, plain){ return stored === encodePassword(plain); }

  /* ---------- Elementos ---------- */
  const formRegister = $('#form-register');
  const registerResult = $('#register-result');
  const btnOpenLoginStaff = $('#open-login-staff');
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

  const modalRegistered = $('#modal-registered');
  const regCodeEl = $('#reg-code');
  const btnCloseRegistered = $('#btn-close-registered');

  const modalView = $('#modal-view');
  const modalViewContent = $('#modal-view-content');
  const btnCloseView = $('#btn-close-view');

  const btnViewActive = $('#btn-view-active');
  const btnViewEgresados = $('#btn-view-egresados');
  const btnViewAudit = $('#btn-view-audit');

  /* ---------- Inicializadores de recursos (rooms, doctors) ---------- */
  function initializeRooms(){
    // Ejemplo: habitaciones 201 a 205, cada una con camas A y B
    const rooms = [];
    for(let r=201; r<=205; r++){
      const roomLabel = String(r);
      rooms.push({
        id: 'room-' + roomLabel,
        roomLabel,
        beds: [
          { id: `bed-${roomLabel}-A`, label: `${roomLabel}-A`, occupiedBy: null },
          { id: `bed-${roomLabel}-B`, label: `${roomLabel}-B`, occupiedBy: null }
        ]
      });
    }
    write(STORAGE_KEYS.ROOMS, rooms);
  }
  function initializeDoctors(){
    // 5 doctores con dos nombres y dos apellidos (ejemplo)
    const doctors = [
      { id: uid('doc'), name: 'Ana María López Pérez', patients: [] },
      { id: uid('doc'), name: 'Carlos Andrés Martínez Gómez', patients: [] },
      { id: uid('doc'), name: 'Laura Valentina Ruiz Sánchez', patients: [] },
      { id: uid('doc'), name: 'Diego Fernando Torres Ramírez', patients: [] },
      { id: uid('doc'), name: 'María Fernanda Gómez Herrera', patients: [] }
    ];
    write(STORAGE_KEYS.DOCTORS, doctors);
  }

  function getRooms(){ return read(STORAGE_KEYS.ROOMS) || []; }
  function saveRooms(r){ write(STORAGE_KEYS.ROOMS, r); }
  function getDoctors(){ return read(STORAGE_KEYS.DOCTORS) || []; }
  function saveDoctors(d){ write(STORAGE_KEYS.DOCTORS, d); }
  function getAudit(){ return read(STORAGE_KEYS.AUDIT) || []; }
  function saveAudit(a){ write(STORAGE_KEYS.AUDIT, a); }

  function logAudit(entry){
    const audits = getAudit();
    audits.unshift(Object.assign({ id: uid('audit'), time: now() }, entry));
    saveAudit(audits);
  }

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
      procedures: [], // [{id,desc, performedBy, time}]
      // Nuevo campo: control de privacidad de procedimientos (por defecto NO compartir)
      shareWithCompanion: false
    };
    const patients = getPatients();
    patients.unshift(patient);
    savePatients(patients);
    return patient;
  }
  function updatePatient(id, patch, auditNote){
    const patients = getPatients();
    const idx = patients.findIndex(p=>p.id===id);
    if(idx===-1) throw new Error('Paciente no encontrado');
    const before = Object.assign({}, patients[idx]);
    patients[idx] = Object.assign({}, patients[idx], patch);
    write(STORAGE_KEYS.PATIENTS, patients);
    if(auditNote){
      logAudit(Object.assign({ patientId: id, user: (currentSession() ? currentSession().username : 'system') }, auditNote));
    }
    return patients[idx];
  }

  function addProcedure(patientId, desc, performedBy){
    const patients = getPatients();
    const p = patients.find(x=>x.id===patientId);
    if(!p) throw new Error('Paciente no encontrado');
    const proc = { id: uid('proc'), desc, performedBy, time: now() };
    p.procedures = p.procedures || [];
    p.procedures.unshift(proc);
    write(STORAGE_KEYS.PATIENTS, patients);

    // Registrar auditoría de creación de procedimiento
    logAudit({
      action: 'add_procedure',
      patientId: patientId,
      procedureId: proc.id,
      performedBy,
      details: { desc: desc }
    });

    // REFRESCAR UI
    try { renderPatientList(searchInput.value.trim()); } catch(e){ /* safe */ }
    try {
      const detailWrap = patientDetailEl.querySelector('[data-patient-id]');
      if(detailWrap && detailWrap.getAttribute('data-patient-id') === p.id){
        showPatientDetail(p.id);
      }
    } catch(e){ /* safe */ }

    // actualizar companion si se está mostrando y comparte
    try {
      const compCodeInput = $('#comp-code');
      if(compCodeInput && modalView && !modalView.classList.contains('hidden') && compCodeInput.value.trim() === p.publicCode){
        showCompanionInModal(p.publicCode);
      }
    } catch(e){ /* safe */ }

    return proc;
  }

  function editProcedure(patientId, procedureId, newDesc, newPerformedBy){
    const patients = getPatients();
    const p = patients.find(x=>x.id===patientId);
    if(!p) throw new Error('Paciente no encontrado');
    const proc = (p.procedures || []).find(pr=>pr.id===procedureId);
    if(!proc) throw new Error('Procedimiento no encontrado');
    const before = Object.assign({}, proc);
    proc.desc = newDesc;
    proc.performedBy = newPerformedBy;
    proc.time = now(); // actualizar hora a la edición
    write(STORAGE_KEYS.PATIENTS, patients);

    // auditoría
    logAudit({
      action: 'edit_procedure',
      patientId,
      procedureId,
      user: (currentSession() ? currentSession().username : 'system'),
      details: { before, after: Object.assign({}, proc) }
    });

    // re-render
    renderPatientList(searchInput.value.trim());
    try {
      const detailWrap = patientDetailEl.querySelector('[data-patient-id]');
      if(detailWrap && detailWrap.getAttribute('data-patient-id') === p.id){
        showPatientDetail(p.id);
      }
    } catch(e){ /* safe */ }

    // actualizar vista companion si aplica
    try {
      const compCodeInput = $('#comp-code');
      if(compCodeInput && modalView && !modalView.classList.contains('hidden') && compCodeInput.value.trim() === p.publicCode){
        showCompanionInModal(p.publicCode);
      }
    } catch(e){ /* safe */ }
  }

  /* ---------- Lista de pacientes (única) con filtros: texto + estado ---------- */
  // estado posible: 'all' | 'active' | 'discharged'
  let currentListFilter = 'all';

  function renderPatientList(textFilter=''){
    const all = getPatients();
    const f = (textFilter || '').toLowerCase().trim();

    // aplicar filtro por estado
    let filtered = all.filter(p=>{
      if(currentListFilter === 'active') return !p.dischargedAt;
      if(currentListFilter === 'discharged') return !!p.dischargedAt;
      return true;
    });

    // aplicar filtro por texto
    if(f){
      filtered = filtered.filter(p=>{
        return (p.name && p.name.toLowerCase().includes(f)) ||
               (p.internalId && p.internalId.toLowerCase().includes(f)) ||
               (p.publicCode && p.publicCode.toLowerCase().includes(f)) ||
               (p.reason && p.reason.toLowerCase().includes(f));
      });
    }

    patientListEl.innerHTML = '';
    if(filtered.length===0){
      patientListEl.innerHTML = '<div class="muted">No hay pacientes registrados</div>';
      return;
    }
    filtered.forEach(p=>{
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

  /* ---------- Mostrar detalle paciente (sin cambios funcionales importantes) ---------- */
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
          <button class="btn primary" id="btn-open-confirm-arrival">${p.arrived ? 'Llegada confirmada' : 'Confirmar llegada'}</button>
          <button class="btn" id="btn-open-assign-room">Asignar Hab/Cam</button>
          <button class="btn" id="btn-open-assign-doctor">Asignar personal</button>
          <button class="btn ghost" id="btn-open-set-admit">${p.admittedAt ? 'Ingreso marcado' : 'Marcar ingreso'}</button>
          <button class="btn ghost" id="btn-open-set-discharge">${p.dischargedAt ? 'Egreso marcado' : 'Marcar egreso'}</button>
        </div>
        <div style="margin-top:10px">
          <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="chk-share-proc" ${p.shareWithCompanion ? 'checked' : ''}/> Compartir historial de procedimientos con acompañante</label>
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

    // Procedimientos (visibles para quien tenga acceso según shareWithCompanion y rol)
    html += `<div class="timeline"><h4>Historial de procedimientos</h4>`;
    if(!p.procedures || p.procedures.length===0) html += `<div class="muted">Sin procedimientos registrados</div>`;
    (p.procedures || []).forEach(pr=>{
      html += `<div class="proc">
                 <div>
                   <strong>${pr.desc}</strong><br>
                   <small>${pr.performedBy || '---'} · ${new Date(pr.time).toLocaleString()}</small>
                 </div>
                 <div class="proc-actions">`;
      if(role === 'medico' || role === 'admin'){
        html += `<button class="btn" data-proc-edit="${pr.id}" data-proc-patient="${p.id}">Editar</button>`;
      }
      html += `</div></div>`;
    });
    html += `</div></div>`;

    // Insertamos wrapper con data-patient-id para identificar por id en re-renders
    patientDetailEl.innerHTML = `<div data-patient-id="${p.id}">` + html + `</div>`;

    // Enlazar botones (se apoyan en modales grandes definidos más abajo)
    if(role === 'medico' || role === 'admin'){
      // usar delegates seguros (elementos existen ahora)
      const btnArrival = $('#btn-open-confirm-arrival');
      if(btnArrival) btnArrival.addEventListener('click', ()=> openArrivalModal(p.id));

      const btnAssignRoom = $('#btn-open-assign-room');
      if(btnAssignRoom) btnAssignRoom.addEventListener('click', ()=> openAssignRoomModal(p.id));

      const btnAssignDoctor = $('#btn-open-assign-doctor');
      if(btnAssignDoctor) btnAssignDoctor.addEventListener('click', ()=> openAssignDoctorModal(p.id));

      const btnAdmit = $('#btn-open-set-admit');
      if(btnAdmit) btnAdmit.addEventListener('click', ()=> openAdmitModal(p.id));

      const btnDischarge = $('#btn-open-set-discharge');
      if(btnDischarge) btnDischarge.addEventListener('click', ()=> openDischargeModal(p.id));

      // toggle compartir procedimientos
      const chk = $('#chk-share-proc');
      if(chk){
        chk.addEventListener('change', ()=>{
          updatePatient(p.id, { shareWithCompanion: !!chk.checked }, {
            action: 'toggle_share_procedures',
            details: { shareWithCompanion: !!chk.checked }
          });
        });
      }

      const btnAddProc = $('#btn-add-proc');
      if(btnAddProc){
        btnAddProc.addEventListener('click', ()=>{
          const desc = $('#inp-proc-desc').value.trim();
          const by = $('#inp-proc-by').value.trim() || (currentSession() ? currentSession().username : 'staff');
          if(!desc) return alert('Describe el procedimiento');

          // Verificar que campos obligatorios hayan sido completados
          const fresh = getPatients().find(x=>x.id===p.id);
          const missing = [];
          if(!fresh.arrived) missing.push('Confirmar llegada');
          if(!fresh.assignedRoom) missing.push('Asignar habitación/sala');
          if(!fresh.assignedBed) missing.push('Asignar camilla');
          if(!fresh.attending) missing.push('Asignar personal que atiende');
          if(missing.length>0){
            return alert('No es posible agregar procedimientos. Faltan campos obligatorios: ' + missing.join(', '));
          }

          addProcedure(p.id, desc, by);
          $('#inp-proc-desc').value = '';
          $('#inp-proc-by').value = '';
        });
      }

      // Edit buttons for procedures (attach via querySelectorAll inside patientDetailEl)
      const procEditBtns = patientDetailEl.querySelectorAll('[data-proc-edit]');
      procEditBtns.forEach(btn=>{
        btn.addEventListener('click', (ev)=>{
          const procId = btn.getAttribute('data-proc-edit');
          const pid = btn.getAttribute('data-proc-patient');
          openEditProcedureModal(pid, procId);
        });
      });
    }
  }

  /* ---------- MODALES DE ACCIÓN (lógica para abrir modales grandes y controlarlas) ---------- */
  function openModalView(htmlContent){
    // Render content inside modalViewContent
    modalViewContent.innerHTML = htmlContent;
    modalView.classList.remove('hidden');
    // ensure modal is over the panel
    modalView.style.zIndex = '9999';
    // disable interactions with panel behind
    if(panelStaff){
      panelStaff.style.pointerEvents = 'none';
      panelStaff.style.filter = 'blur(0.6px)';
    }
    // scroll top
    modalViewContent.scrollTop = 0;
    // focus first focusable element
    const firstFocusable = modalViewContent.querySelector('button, input, a, textarea, select');
    if(firstFocusable) firstFocusable.focus();
  }
  function closeModalView(){
    modalView.classList.add('hidden');
    modalViewContent.innerHTML = '';
    // restore interactions with panel behind
    if(panelStaff){
      panelStaff.style.pointerEvents = '';
      panelStaff.style.filter = '';
    }
    // clear companion input (security)
    const compInput = $('#comp-code');
    if(compInput) compInput.value = '';
    modalView.style.zIndex = '';
  }
  if(btnCloseView) btnCloseView.addEventListener('click', ()=> closeModalView());

  /* ---------- Modales específicos (con listeners atados desde modalViewContent) ---------- */

  // Arrival confirm modal
  function openArrivalModal(patientId){
    const p = getPatients().find(x=>x.id===patientId);
    const html = `<div>
      <h3>Confirmar llegada - ${p.name}</h3>
      <p class="muted">Al confirmar llegada se registra la hora de llegada del paciente.</p>
      <div style="margin-top:12px">
        <button class="btn primary" id="btn-confirm-arrival-ok">Confirmar llegada</button>
        <button class="btn ghost" id="btn-cancel-arrival">Cerrar</button>
      </div>
    </div>`;
    openModalView(html);

    // attach listeners using modalViewContent scope (reliable)
    const ok = modalViewContent.querySelector('#btn-confirm-arrival-ok');
    const cancel = modalViewContent.querySelector('#btn-cancel-arrival');
    if(ok) ok.addEventListener('click', ()=>{
      updatePatient(patientId, { arrived: true, arrivedAt: now() }, { action:'confirm_arrival', details: {} });
      renderPatientList(searchInput.value.trim());
      showPatientDetail(patientId);
      closeModalView();
    });
    if(cancel) cancel.addEventListener('click', ()=> closeModalView());
  }

  // Assign room modal
  function openAssignRoomModal(patientId){
    const rooms = getRooms();
    let html = `<div><h3>Asignar habitación / camilla</h3>
      <p class="muted">Selecciona una cama disponible. Si una cama está ocupada aparecerá como ocupada.</p>
      <div class="room-list">`;
    rooms.forEach(room=>{
      html += `<div class="room-item"><div><strong>Hab ${room.roomLabel}</strong> <small class="muted">Camas:</small></div><div>`;
      room.beds.forEach(b=>{
        const disabledAttr = b.occupiedBy ? 'disabled' : '';
        const label = b.label || b.id;
        if(b.occupiedBy){
          html += `<span style="margin-left:8px"><span class="badge">Ocupada</span> <small class="muted">${label}</small></span>`;
        } else {
          html += `<button class="btn" data-assign-bed="${b.id}" data-room="${room.roomLabel}" style="margin-left:8px">Asignar ${b.label}</button>`;
        }
      });
      html += `</div></div>`;
    });
    html += `</div><div style="margin-top:12px"><button class="btn ghost" id="btn-cancel-assign-room">Cerrar</button></div></div>`;

    openModalView(html);

    // attach handlers for assign buttons inside modalViewContent
    const assignBtns = modalViewContent.querySelectorAll('[data-assign-bed]');
    assignBtns.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const bedId = btn.getAttribute('data-assign-bed');
        const roomLabel = btn.getAttribute('data-room');

        // Get latest structures
        const roomsNow = getRooms();
        let targetBed = null, targetRoom = null;
        roomsNow.forEach(r=>{
          r.beds.forEach(b=>{
            if(b.id === bedId){ targetBed = b; targetRoom = r; }
          });
        });
        if(!targetBed) return alert('Cama no encontrada');
        if(targetBed.occupiedBy) return alert('Cama ya está ocupada');

        // release previous bed if any
        const patientsNow = getPatients();
        const patient = patientsNow.find(x=>x.id===patientId);
        if(patient.assignedBed){
          const rooms2 = getRooms();
          rooms2.forEach(r=>{
            r.beds.forEach(b=>{
              if(b.id === patient.assignedBed) b.occupiedBy = null;
            });
          });
          saveRooms(rooms2);
        }

        // occupy selected bed
        const rooms3 = getRooms();
        rooms3.forEach(r=>{
          r.beds.forEach(b=>{
            if(b.id === bedId) b.occupiedBy = patientId;
          });
        });
        saveRooms(rooms3);

        // update patient assignedRoom/assignedBed
        updatePatient(patientId, { assignedRoom: roomLabel, assignedBed: bedId }, { action:'assign_bed', details: { room: roomLabel, bed: bedId }});
        renderPatientList(searchInput.value.trim());
        showPatientDetail(patientId);
        closeModalView();
      });
    });

    const cancelBtn = modalViewContent.querySelector('#btn-cancel-assign-room');
    if(cancelBtn) cancelBtn.addEventListener('click', ()=> closeModalView());
  }

  // Assign doctor modal
  function openAssignDoctorModal(patientId){
    const doctors = getDoctors();
    let html = `<div><h3>Asignar personal (doctor/enfermero)</h3>
      <p class="muted">Selecciona el personal que atenderá (puede atender a varios pacientes).</p>
      <div class="doctor-list">`;
    doctors.forEach(doc=>{
      html += `<div class="doctor-item"><div><strong>${doc.name}</strong><div class="muted">Atendiendo: ${doc.patients.length} pacientes</div></div>
                <div><button class="btn" data-assign-doctor="${doc.id}">Asignar</button></div></div>`;
    });
    html += `</div><div style="margin-top:12px"><button class="btn ghost" id="btn-cancel-assign-doc">Cerrar</button></div></div>`;

    openModalView(html);

    // attach assign handlers
    const assignDocBtns = modalViewContent.querySelectorAll('[data-assign-doctor]');
    assignDocBtns.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const docId = btn.getAttribute('data-assign-doctor');
        const docs = getDoctors();
        const doc = docs.find(d=>d.id===docId);
        if(!doc) return alert('Personal no encontrado');

        // Add patient to doctor's list if not present
        if(!doc.patients.includes(patientId)) doc.patients.push(patientId);
        saveDoctors(docs);

        // update patient's attending (name)
        updatePatient(patientId, { attending: doc.name }, { action:'assign_staff', details: { staffId: doc.id, staffName: doc.name }});
        renderPatientList(searchInput.value.trim());
        showPatientDetail(patientId);
        closeModalView();
      });
    });

    const cancelBtn = modalViewContent.querySelector('#btn-cancel-assign-doc');
    if(cancelBtn) cancelBtn.addEventListener('click', ()=> closeModalView());
  }

  // Admit modal (mark admittedAt)
  function openAdmitModal(patientId){
    const p = getPatients().find(x=>x.id===patientId);
    const html = `<div>
      <h3>Marcar ingreso - ${p.name}</h3>
      <p class="muted">Registrar hora de ingreso.</p>
      <div style="margin-top:12px">
        <button class="btn primary" id="btn-confirm-admit">Marcar ingreso</button>
        <button class="btn ghost" id="btn-cancel-admit">Cerrar</button>
      </div>
    </div>`;
    openModalView(html);
    const confirm = modalViewContent.querySelector('#btn-confirm-admit');
    const cancel = modalViewContent.querySelector('#btn-cancel-admit');
    if(confirm) confirm.addEventListener('click', ()=>{
      updatePatient(patientId, { admittedAt: now() }, { action:'mark_admit', details:{} });
      renderPatientList(searchInput.value.trim());
      showPatientDetail(patientId);
      closeModalView();
    });
    if(cancel) cancel.addEventListener('click', ()=> closeModalView());
  }

  // Discharge modal (mark dischargedAt) and free bed + decrement doctor count
  function openDischargeModal(patientId){
    const p = getPatients().find(x=>x.id===patientId);
    const html = `<div>
      <h3>Marcar egreso - ${p.name}</h3>
      <p class="muted">Registrar egreso y liberar recursos (camilla, actualizar doctor).</p>
      <div style="margin-top:12px">
        <button class="btn primary" id="btn-confirm-discharge">Confirmar egreso</button>
        <button class="btn ghost" id="btn-cancel-discharge">Cerrar</button>
      </div>
    </div>`;
    openModalView(html);

    const confirm = modalViewContent.querySelector('#btn-confirm-discharge');
    const cancel = modalViewContent.querySelector('#btn-cancel-discharge');

    if(confirm) confirm.addEventListener('click', ()=>{
      // Get latest patient info
      const patientsNow = getPatients();
      const patient = patientsNow.find(x=>x.id===patientId);
      if(!patient) return alert('Paciente no encontrado');

      // liberar camilla si existe
      if(patient.assignedBed){
        const rooms = getRooms();
        rooms.forEach(r=> r.beds.forEach(b=> { if(b.id === patient.assignedBed) b.occupiedBy = null; }));
        saveRooms(rooms);
      }

      // actualizar doctor (quitar paciente de su lista)
      if(patient.attending){
        const docs = getDoctors();
        const doc = docs.find(d=>d.name === patient.attending);
        if(doc){
          doc.patients = (doc.patients || []).filter(pid=> pid !== patientId);
          saveDoctors(docs);
        } else {
          // intentar buscar por id en audit (no crítico)
        }
      }

      updatePatient(patientId, { dischargedAt: now() }, { action:'mark_discharge', details: {} });
      renderPatientList(searchInput.value.trim());
      showPatientDetail(patientId);
      closeModalView();
    });

    if(cancel) cancel.addEventListener('click', ()=> closeModalView());
  }

  // Edit procedure modal
  function openEditProcedureModal(patientId, procedureId){
    const p = getPatients().find(x=>x.id===patientId);
    if(!p) return alert('Paciente no encontrado');
    const pr = (p.procedures || []).find(x=>x.id===procedureId);
    if(!pr) return alert('Procedimiento no encontrado');
    const html = `<div>
      <h3>Editar procedimiento</h3>
      <p class="muted">Modifica la descripción o el responsable del procedimiento.</p>
      <div style="margin-top:12px">
        <label>Descripción</label>
        <input id="edit-proc-desc" value="${escapeHtml(pr.desc)}" />
        <label>Realizado por</label>
        <input id="edit-proc-by" value="${escapeHtml(pr.performedBy || '')}" />
        <div style="margin-top:12px">
          <button class="btn primary" id="btn-save-proc-edit">Guardar</button>
          <button class="btn ghost" id="btn-cancel-proc-edit">Cancelar</button>
        </div>
      </div>
    </div>`;
    openModalView(html);
    const saveBtn = modalViewContent.querySelector('#btn-save-proc-edit');
    const cancelBtn = modalViewContent.querySelector('#btn-cancel-proc-edit');
    if(saveBtn) saveBtn.addEventListener('click', ()=>{
      const newDesc = modalViewContent.querySelector('#edit-proc-desc').value.trim();
      const newBy = modalViewContent.querySelector('#edit-proc-by').value.trim() || (currentSession() ? currentSession().username : 'staff');
      if(!newDesc) return alert('La descripción no puede estar vacía');
      editProcedure(patientId, procedureId, newDesc, newBy);
      closeModalView();
    });
    if(cancelBtn) cancelBtn.addEventListener('click', ()=> closeModalView());
  }

  /* ---------- Companion view inside modal (no persistence after close) ---------- */
  formCompanion.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const code = $('#comp-code').value.trim();
    if(!code) return;
    showCompanionInModal(code);
  });

  function showCompanionInModal(code){
    const p = getPatients().find(x=>x.publicCode === code);
    if(!p){
      openModalView(`<div><h3>Código no encontrado</h3><p class="muted">El código ingresado no corresponde a ningún paciente.</p><div style="margin-top:12px"><button class="btn ghost" id="btn-close-companion-view">Cerrar</button></div></div>`);
      modalViewContent.querySelector('#btn-close-companion-view').addEventListener('click', ()=> closeModalView());
      return;
    }
    // Mostrar información permitida: nombre, motivo, estado de llegada, procedimientos (si shareWithCompanion)
    let html = `<div><h3>${p.name}</h3>
      <div class="detail-grid">
        <div class="kv"><strong>Motivo</strong><div class="muted">${p.reason || '-'}</div></div>
        <div class="kv"><strong>Teléfono</strong><div class="muted">${p.phone || '-'}</div></div>
        <div class="kv"><strong>Llegada</strong><div class="muted">${p.arrived ? 'Confirmada '+ new Date(p.arrivedAt).toLocaleString() : 'Pendiente'}</div></div>
        <div class="kv"><strong>Hab / Camilla</strong><div class="muted">${p.assignedRoom || '-'} / ${p.assignedBed || '-'}</div></div>
        <div class="kv"><strong>Atiende</strong><div class="muted">${p.attending || '-'}</div></div>
      </div>
      <div class="timeline"><h4>Procedimientos (tiempo real)</h4>`;

    if(!p.shareWithCompanion){
      html += `<div class="muted">Los procedimientos son privados para este paciente. No están disponibles para acompañantes.</div>`;
    } else {
      if(!p.procedures || p.procedures.length===0) html += `<div class="muted">Sin procedimientos registrados</div>`;
      (p.procedures || []).forEach(pr=>{
        html += `<div class="proc"><div><strong>${pr.desc}</strong><br><small>${pr.performedBy || '---'} · ${new Date(pr.time).toLocaleString()}</small></div></div>`;
      });
    }

    html += `</div><div style="margin-top:12px"><button class="btn ghost" id="btn-close-companion-view">Cerrar</button></div></div>`;
    openModalView(html);
    modalViewContent.querySelector('#btn-close-companion-view').addEventListener('click', ()=> closeModalView());
  }

  // Close companion panel (small) - ensure clearing inputs and not leaving data
  $('#btn-close-companion').addEventListener('click', ()=>{
    panelCompanion.classList.add('hidden');
    const compInput = $('#comp-code');
    if(compInput) compInput.value = '';
  });

  // open companion (small panel) -> show input
  btnOpenCompanion.addEventListener('click', ()=>{
    panelCompanion.classList.remove('hidden');
    const compInput = $('#comp-code');
    if(compInput) { compInput.value = ''; compInput.focus(); }
  });

  /* ---------- Storage listener (para "tiempo real") ---------- */
  window.addEventListener('storage', ()=>{
    if(!panelStaff.classList.contains('hidden')){
      renderPatientList(searchInput.value.trim());
      const detailWrap = patientDetailEl.querySelector('[data-patient-id]');
      if(detailWrap){
        const pid = detailWrap.getAttribute('data-patient-id');
        const p = getPatients().find(x=>x.id === pid);
        if(p) showPatientDetail(p.id);
      }
    }
  });

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

    // Mostrar modal tipo "Instagram" con código público
    if(regCodeEl) regCodeEl.textContent = patient.publicCode;
    if(modalRegistered) modalRegistered.classList.remove('hidden');

    formRegister.reset();
    renderPatientList(); // actualiza lista staff si está abierta
  });

  $('#btn-clear').addEventListener('click', ()=> formRegister.reset());

  // Cerrar modal de registro
  if(btnCloseRegistered){
    btnCloseRegistered.addEventListener('click', ()=> {
      if(modalRegistered) modalRegistered.classList.add('hidden');
    });
  }

  /* ---------- Login / create user (limpiando campos) ---------- */
  btnOpenLoginStaff.addEventListener('click', ()=> openLoginModal('medico'));
  function openLoginModal(role){
    modalLogin.classList.remove('hidden');
    $('#login-role').value = role;
    $('#login-title').textContent = role === 'medico' ? 'Login - Personal Médico' : 'Login - Administración';
    // limpiar campos por seguridad visual (login y create)
    $('#login-username').value = '';
    $('#login-password').value = '';
    $('#new-username').value = '';
    $('#new-password').value = '';
  }
  $('#btn-cancel-login').addEventListener('click', ()=> {
    modalLogin.classList.add('hidden');
    $('#login-username').value = '';
    $('#login-password').value = '';
    $('#new-username').value = '';
    $('#new-password').value = '';
  });

  formCreateUser.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const u = $('#new-username').value.trim();
    const p = $('#new-password').value.trim();
    const r = $('#new-role').value;
    try{
      saveUser(u,p,r);
      alert('Usuario creado localmente. Úsalo para iniciar sesión.');
      // limpiar campos inmediatamente
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

    // limpiar campos del login para que no queden visibles
    $('#login-username').value = '';
    $('#login-password').value = '';

    modalLogin.classList.add('hidden');
    openStaffPanel(user);
  });

  function openStaffPanel(user){
    panelTitle.textContent = user.role === 'medico' ? `Panel Médico - ${user.username}` : `Panel Administración - ${user.username}`;
    panelStaff.classList.remove('hidden');
    // mostrar botón de auditoría solo a administradores
    if(user.role === 'admin' && btnViewAudit) btnViewAudit.style.display = 'inline-block';
    else if(btnViewAudit) btnViewAudit.style.display = 'none';
    // reset filter
    currentListFilter = 'all';
    updateFilterButtonsUI();
    renderPatientList();
    patientDetailEl.innerHTML = `<div class="muted">Selecciona un paciente para ver detalles</div>`;
  }

  btnLogout.addEventListener('click', ()=>{
    logout();
    $('#login-username').value = '';
    $('#login-password').value = '';
    modalLogin.classList.remove('hidden');
  });

  btnSearch.addEventListener('click', ()=> renderPatientList(searchInput.value.trim()));
  searchInput.addEventListener('keydown', (e)=> { if(e.key==='Enter') renderPatientList(searchInput.value.trim()); });

  /* ---------- Botones Activos / Egresados: filtrar la lista principal ---------- */
  function setListFilter(mode){
    currentListFilter = mode; // 'all' | 'active' | 'discharged'
    updateFilterButtonsUI();
    renderPatientList(searchInput.value.trim());
  }
  function updateFilterButtonsUI(){
    if(!btnViewActive || !btnViewEgresados) return;
    btnViewActive.classList.remove('active');
    btnViewEgresados.classList.remove('active');
    if(currentListFilter === 'active') btnViewActive.classList.add('active');
    if(currentListFilter === 'discharged') btnViewEgresados.classList.add('active');
  }
  if(btnViewActive) btnViewActive.addEventListener('click', ()=> setListFilter('active'));
  if(btnViewEgresados) btnViewEgresados.addEventListener('click', ()=> setListFilter('discharged'));

  /* ---------- Helpers ---------- */
  function escapeHtml(str){
    if(!str) return '';
    return String(str).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
  }

  /* ---------- Initialization ---------- */
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
      return { users:getUsers(), patients:getPatients(), rooms:getRooms(), doctors:getDoctors(), audit:getAudit() };
    },
    importData: (obj)=> {
      if(obj.users) write(STORAGE_KEYS.USERS, obj.users);
      if(obj.patients) write(STORAGE_KEYS.PATIENTS, obj.patients);
      if(obj.rooms) write(STORAGE_KEYS.ROOMS, obj.rooms);
      if(obj.doctors) write(STORAGE_KEYS.DOCTORS, obj.doctors);
      if(obj.audit) write(STORAGE_KEYS.AUDIT, obj.audit);
      alert('Datos importados localmente');
      renderPatientList();
    }
  };

})();
