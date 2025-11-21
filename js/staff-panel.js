// staff-panel.js
(function(){
  const patientsApi = window.eseb && window.eseb.patients;
  const roomsApi = window.eseb && window.eseb.rooms;
  const doctorsApi = window.eseb && window.eseb.doctors;
  const proceduresApi = window.eseb && window.eseb.procedures;
  const auth = window.eseb && window.eseb.auth;
  const modals = window.eseb && window.eseb.modals;
  const utils = window.eseb && window.eseb.utils;
  if(!patientsApi || !roomsApi || !doctorsApi || !proceduresApi || !auth || !modals || !utils) throw new Error('dependencies missing for staff-panel');

  // UI elements
  const panelStaff = document.getElementById('panel-staff');
  const patientListEl = document.getElementById('patient-list');
  const patientDetailEl = document.getElementById('patient-detail');
  const searchInput = document.getElementById('search-patient');
  const btnSearch = document.getElementById('btn-search');

  const btnViewActive = document.getElementById('btn-view-active');
  const btnViewEgresados = document.getElementById('btn-view-egresados');
  const btnLogout = document.getElementById('btn-logout');

  let currentListFilter = 'all'; // 'all' | 'active' | 'discharged'

  // render list (single list controlled by filter + text)
  function renderPatientList(textFilter=''){
    const all = patientsApi.getPatients();
    const f = (textFilter || '').toLowerCase().trim();

    let filtered = all.filter(p=>{
      if(currentListFilter === 'active') return !p.dischargedAt;
      if(currentListFilter === 'discharged') return !!p.dischargedAt;
      return true;
    });

    if(f){
      filtered = filtered.filter(p=>{
        return (p.name && p.name.toLowerCase().includes(f)) ||
               (p.internalId && p.internalId.toLowerCase().includes(f)) ||
               (p.publicCode && p.publicCode.toLowerCase().includes(f)) ||
               (p.reason && p.reason.toLowerCase().includes(f));
      });
    }

    patientListEl.innerHTML = '';
    if(filtered.length === 0){
      patientListEl.innerHTML = '<div class="muted">No hay pacientes registrados</div>';
      return;
    }

    filtered.forEach(p=>{
      const div = document.createElement('div');
      div.className = 'patient-item';
      div.innerHTML = `<div>
                        <strong>${utils.escapeHtml(p.name)}</strong><br>
                        <small>${utils.escapeHtml(p.reason || '')} · ${utils.escapeHtml(p.phone || '')}</small>
                       </div>
                       <div style="text-align:right">
                         <small>Public: ${utils.escapeHtml(p.publicCode)}</small><br>
                         <small>Creado: ${new Date(p.createdAt).toLocaleString()}</small>
                       </div>`;
      div.addEventListener('click', ()=> showPatientDetail(p.id));
      patientListEl.appendChild(div);
    });
  }

  function showPatientDetail(patientId){
    const session = auth.currentSession();
    const role = session ? session.role : null;
    const p = patientsApi.getPatients().find(x=> x.id === patientId);
    if(!p){
      patientDetailEl.innerHTML = '<div class="muted">Paciente no encontrado</div>';
      return;
    }

    let html = `<div>
      <div class="detail-card">
        <h3>${utils.escapeHtml(p.name)}</h3>
        <div class="detail-grid">
          <div class="kv"><strong>Creado</strong><div class="muted">${new Date(p.createdAt).toLocaleString()}</div></div>
          <div class="kv"><strong>Código público</strong><div class="muted">${utils.escapeHtml(p.publicCode)}</div></div>
          <div class="kv"><strong>Teléfono</strong><div class="muted">${utils.escapeHtml(p.phone || '-')}</div></div>
          <div class="kv"><strong>Motivo</strong><div class="muted">${utils.escapeHtml(p.reason || '-')}</div></div>
          <div class="kv"><strong>Notas</strong><div class="muted">${utils.escapeHtml(p.notes || '-')}</div></div>
        </div>`;

    if(role === 'medico' || role === 'admin'){
      html += `<div style="margin-top:12px">
        <div class="detail-grid">
          <div class="kv"><strong>Internal ID</strong><div class="muted">${utils.escapeHtml(p.internalId)}</div></div>
          <div class="kv"><strong>Documento</strong><div class="muted">${utils.escapeHtml(p.doc || '-')}</div></div>
          <div class="kv"><strong>Llegada</strong><div class="muted">${p.arrived ? 'Confirmada '+ new Date(p.arrivedAt).toLocaleString() : 'Pendiente'}</div></div>
          <div class="kv"><strong>Hab / Camilla</strong><div class="muted">${utils.escapeHtml(p.assignedRoom || '-')} / ${utils.escapeHtml(p.assignedBed || '-')}</div></div>
          <div class="kv"><strong>Atiende</strong><div class="muted">${utils.escapeHtml(p.attending || '-')}</div></div>
          <div class="kv"><strong>Ingreso</strong><div class="muted">${p.admittedAt ? new Date(p.admittedAt).toLocaleString() : '-'}</div></div>
          <div class="kv"><strong>Egreso</strong><div class="muted">${p.dischargedAt ? new Date(p.dischargedAt).toLocaleString() : '-'}</div></div>
        </div>
        </div>`;
    }

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

    html += `<div class="timeline"><h4>Historial de procedimientos</h4>`;
    if(!p.procedures || p.procedures.length === 0) html += `<div class="muted">Sin procedimientos registrados</div>`;
    (p.procedures || []).forEach(pr=>{
      html += `<div class="proc">
                 <div>
                   <strong>${utils.escapeHtml(pr.desc)}</strong><br>
                   <small>${utils.escapeHtml(pr.performedBy || '---')} · ${new Date(pr.time).toLocaleString()}</small>
                 </div>
                 <div class="proc-actions">`;
      if(role === 'medico' || role === 'admin'){
        html += `<button class="btn" data-proc-edit="${utils.escapeHtml(pr.id)}" data-proc-patient="${utils.escapeHtml(p.id)}">Editar</button>`;
      }
      html += `</div></div>`;
    });
    html += `</div></div>`;

    patientDetailEl.innerHTML = `<div data-patient-id="${p.id}">` + html + `</div>`;

    // attach handlers
    const btnArrival = document.getElementById('btn-open-confirm-arrival');
    if(btnArrival) btnArrival.addEventListener('click', ()=> openArrivalModal(p.id));

    const btnAssignRoom = document.getElementById('btn-open-assign-room');
    if(btnAssignRoom) btnAssignRoom.addEventListener('click', ()=> openAssignRoomModal(p.id));

    const btnAssignDoctor = document.getElementById('btn-open-assign-doctor');
    if(btnAssignDoctor) btnAssignDoctor.addEventListener('click', ()=> openAssignDoctorModal(p.id));

    const btnAdmit = document.getElementById('btn-open-set-admit');
    if(btnAdmit) btnAdmit.addEventListener('click', ()=> openAdmitModal(p.id));

    const btnDischarge = document.getElementById('btn-open-set-discharge');
    if(btnDischarge) btnDischarge.addEventListener('click', ()=> openDischargeModal(p.id));

    const chk = document.getElementById('chk-share-proc');
    if(chk){
      chk.addEventListener('change', ()=> {
        patientsApi.updatePatient(p.id, { shareWithCompanion: !!chk.checked }, { action:'toggle_share_procedures', details: { shareWithCompanion: !!chk.checked } });
      });
    }

    const btnAddProc = document.getElementById('btn-add-proc');
    if(btnAddProc){
      btnAddProc.addEventListener('click', ()=> {
        const desc = document.getElementById('inp-proc-desc').value.trim();
        const by = document.getElementById('inp-proc-by').value.trim() || (auth.currentSession() ? auth.currentSession().username : 'staff');
        if(!desc) return alert('Describe el procedimiento');

        // validate required fields on patient
        const fresh = patientsApi.getPatients().find(x=> x.id === p.id);
        const missing = [];
        if(!fresh.arrived) missing.push('Confirmar llegada');
        if(!fresh.assignedRoom) missing.push('Asignar habitación/sala');
        if(!fresh.assignedBed) missing.push('Asignar camilla');
        if(!fresh.attending) missing.push('Asignar personal que atiende');
        if(missing.length > 0){
          return alert('No es posible agregar procedimientos. Faltan campos obligatorios: ' + missing.join(', '));
        }

        proceduresApi.addProcedure(p.id, desc, by);
        document.getElementById('inp-proc-desc').value = '';
        document.getElementById('inp-proc-by').value = '';
      });
    }

    // edit proc buttons
    const procEditBtns = patientDetailEl.querySelectorAll('[data-proc-edit]');
    procEditBtns.forEach(btn => {
      btn.addEventListener('click', ()=> {
        const procId = btn.getAttribute('data-proc-edit');
        const pid = btn.getAttribute('data-proc-patient');
        openEditProcedureModal(pid, procId);
      });
    });
  }

  // modal helpers that call modals + underlying APIs
  function openArrivalModal(patientId){
    const p = patientsApi.getPatients().find(x=> x.id === patientId);
    const html = `<div>
      <h3>Confirmar llegada - ${utils.escapeHtml(p.name)}</h3>
      <p class="muted">Al confirmar llegada se registra la hora de llegada del paciente.</p>
      <div style="margin-top:12px">
        <button class="btn primary" id="btn-confirm-arrival-ok">Confirmar llegada</button>
        <button class="btn ghost" id="btn-cancel-arrival">Cerrar</button>
      </div>
    </div>`;
    modals.openModalLarge(html);
    setTimeout(()=>{
      const ok = document.getElementById('btn-confirm-arrival-ok');
      const cancel = document.getElementById('btn-cancel-arrival');
      if(ok) ok.addEventListener('click', ()=> {
        patientsApi.updatePatient(patientId, { arrived: true, arrivedAt: utils.now() }, { action:'confirm_arrival' });
        renderPatientList(searchInput.value.trim());
        showPatientDetail(patientId);
        modals.closeModalLarge();
      });
      if(cancel) cancel.addEventListener('click', ()=> modals.closeModalLarge());
    }, 10);
  }

  function openAssignRoomModal(patientId){
    const rooms = roomsApi.getRooms();
    let html = `<div><h3>Asignar habitación / camilla</h3>
      <p class="muted">Selecciona una cama disponible.</p>
      <div class="room-list">`;
    rooms.forEach(room => {
      html += `<div class="room-item"><div><strong>Hab ${room.roomLabel}</strong> <small class="muted">Camas:</small></div><div>`;
      room.beds.forEach(b => {
        if(b.occupiedBy){
          html += `<span style="margin-left:8px"><span class="badge">Ocupada</span> <small class="muted">${utils.escapeHtml(b.label)}</small></span>`;
        } else {
          html += `<button class="btn" data-assign-bed="${utils.escapeHtml(b.id)}" data-room="${utils.escapeHtml(room.roomLabel)}" style="margin-left:8px">Asignar ${utils.escapeHtml(b.label)}</button>`;
        }
      });
      html += `</div></div>`;
    });
    html += `</div><div style="margin-top:12px"><button class="btn ghost" id="btn-cancel-assign-room">Cerrar</button></div></div>`;
    modals.openModalLarge(html);

    setTimeout(()=>{
      const assignBtns = document.querySelectorAll('[data-assign-bed]');
      assignBtns.forEach(btn => {
        btn.addEventListener('click', ()=> {
          const bedId = btn.getAttribute('data-assign-bed');
          const roomLabel = btn.getAttribute('data-room');
          try{
            roomsApi.assignBed(patientId, bedId);
            // update patient object to reflect assigned room/bed
            patientsApi.updatePatient(patientId, { assignedRoom: roomLabel, assignedBed: bedId }, { action:'assign_bed', details: { room: roomLabel, bed: bedId } });
            renderPatientList(searchInput.value.trim());
            showPatientDetail(patientId);
            modals.closeModalLarge();
          }catch(err){
            alert(err.message || 'Error asignando cama');
          }
        });
      });
      const cancel = document.getElementById('btn-cancel-assign-room');
      if(cancel) cancel.addEventListener('click', ()=> modals.closeModalLarge());
    }, 10);
  }

  function openAssignDoctorModal(patientId){
    const doctors = doctorsApi.getDoctors();
    let html = `<div><h3>Asignar personal (doctor/enfermero)</h3>
      <p class="muted">Selecciona el personal que atenderá (puede atender a varios pacientes).</p>
      <div class="doctor-list">`;
    doctors.forEach(doc => {
      html += `<div class="doctor-item"><div><strong>${utils.escapeHtml(doc.name)}</strong><div class="muted">Atendiendo: ${doc.patients.length} pacientes</div></div>
                <div><button class="btn" data-assign-doctor="${utils.escapeHtml(doc.id)}">Asignar</button></div></div>`;
    });
    html += `</div><div style="margin-top:12px"><button class="btn ghost" id="btn-cancel-assign-doc">Cerrar</button></div></div>`;
    modals.openModalLarge(html);

    setTimeout(()=>{
      const assignBtns = document.querySelectorAll('[data-assign-doctor]');
      assignBtns.forEach(btn => {
        btn.addEventListener('click', ()=> {
          const docId = btn.getAttribute('data-assign-doctor');
          try{
            doctorsApi.assignPatientToDoctor(docId, patientId);
            const doc = doctorsApi.getDoctors().find(d => d.id === docId);
            patientsApi.updatePatient(patientId, { attending: doc.name }, { action:'assign_staff', details: { staffId: doc.id, staffName: doc.name }});
            renderPatientList(searchInput.value.trim());
            showPatientDetail(patientId);
            modals.closeModalLarge();
          }catch(err){
            alert(err.message || 'Error asignando personal');
          }
        });
      });
      const cancel = document.getElementById('btn-cancel-assign-doc');
      if(cancel) cancel.addEventListener('click', ()=> modals.closeModalLarge());
    }, 10);
  }

  function openAdmitModal(patientId){
    const p = patientsApi.getPatients().find(x=> x.id === patientId);
    const html = `<div>
      <h3>Marcar ingreso - ${utils.escapeHtml(p.name)}</h3>
      <p class="muted">Registrar hora de ingreso.</p>
      <div style="margin-top:12px">
        <button class="btn primary" id="btn-confirm-admit">Marcar ingreso</button>
        <button class="btn ghost" id="btn-cancel-admit">Cerrar</button>
      </div>
    </div>`;
    modals.openModalLarge(html);
    setTimeout(()=>{
      const confirm = document.getElementById('btn-confirm-admit');
      const cancel = document.getElementById('btn-cancel-admit');
      if(confirm) confirm.addEventListener('click', ()=>{
        patientsApi.updatePatient(patientId, { admittedAt: utils.now() }, { action:'mark_admit' });
        renderPatientList(searchInput.value.trim());
        showPatientDetail(patientId);
        modals.closeModalLarge();
      });
      if(cancel) cancel.addEventListener('click', ()=> modals.closeModalLarge());
    }, 10);
  }

  function openDischargeModal(patientId){
    const p = patientsApi.getPatients().find(x=> x.id === patientId);
    const html = `<div>
      <h3>Marcar egreso - ${utils.escapeHtml(p.name)}</h3>
      <p class="muted">Registrar egreso y liberar recursos (camilla, actualizar doctor).</p>
      <div style="margin-top:12px">
        <button class="btn primary" id="btn-confirm-discharge">Confirmar egreso</button>
        <button class="btn ghost" id="btn-cancel-discharge">Cerrar</button>
      </div>
    </div>`;
    modals.openModalLarge(html);
    setTimeout(()=>{
      const confirm = document.getElementById('btn-confirm-discharge');
      const cancel = document.getElementById('btn-cancel-discharge');
      if(confirm) confirm.addEventListener('click', ()=>{
        // free bed
        const patient = patientsApi.getPatients().find(x=> x.id === patientId);
        if(patient.assignedBed){
          roomsApi.releaseBed(patient.assignedBed);
        }
        // remove from doctor
        if(patient.attending){
          const docs = doctorsApi.getDoctors();
          const doc = docs.find(d=> d.name === patient.attending);
          if(doc) doctorsApi.removePatientFromDoctor(doc.id, patientId);
        }
        patientsApi.updatePatient(patientId, { dischargedAt: utils.now() }, { action:'mark_discharge' });
        renderPatientList(searchInput.value.trim());
        showPatientDetail(patientId);
        modals.closeModalLarge();
      });
      if(cancel) cancel.addEventListener('click', ()=> modals.closeModalLarge());
    }, 10);
  }

  function openEditProcedureModal(patientId, procedureId){
    const patients = patientsApi.getPatients();
    const p = patients.find(x=> x.id === patientId);
    if(!p) return alert('Paciente no encontrado');
    const pr = (p.procedures || []).find(x => x.id === procedureId);
    if(!pr) return alert('Procedimiento no encontrado');

    const html = `<div>
      <h3>Editar procedimiento</h3>
      <p class="muted">Modifica la descripción o el responsable del procedimiento.</p>
      <div style="margin-top:12px">
        <label>Descripción</label>
        <input id="edit-proc-desc" value="${utils.escapeHtml(pr.desc)}" />
        <label>Realizado por</label>
        <input id="edit-proc-by" value="${utils.escapeHtml(pr.performedBy || '')}" />
        <div style="margin-top:12px">
          <button class="btn primary" id="btn-save-proc-edit">Guardar</button>
          <button class="btn ghost" id="btn-cancel-proc-edit">Cancelar</button>
        </div>
      </div>
    </div>`;
    modals.openModalLarge(html);

    setTimeout(()=>{
      const saveBtn = document.getElementById('btn-save-proc-edit');
      const cancelBtn = document.getElementById('btn-cancel-proc-edit');
      if(saveBtn) saveBtn.addEventListener('click', ()=>{
        const newDesc = document.getElementById('edit-proc-desc').value.trim();
        const newBy = document.getElementById('edit-proc-by').value.trim() || (auth.currentSession() ? auth.currentSession().username : 'staff');
        if(!newDesc) return alert('La descripción no puede estar vacía');
        proceduresApi.editProcedure(patientId, procedureId, newDesc, newBy);
        modals.closeModalLarge();
      });
      if(cancelBtn) cancelBtn.addEventListener('click', ()=> modals.closeModalLarge());
    }, 10);
  }

  // filter button UI
  function setListFilter(mode){
    currentListFilter = mode;
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

  // perform a clean UI hide & reset when logging out
  function handleLogoutUI(){
    // hide staff panel
    if(panelStaff) panelStaff.classList.add('hidden');
    // ensure login modal is hidden (do not open it)
    const loginModal = document.getElementById('modal-login');
    if(loginModal) loginModal.classList.add('hidden');
    // close modals if open
    if(modals && typeof modals.closeModalLarge === 'function') modals.closeModalLarge();
    // clear details and list
    if(patientDetailEl) patientDetailEl.innerHTML = '<div class="muted">Selecciona un paciente para ver detalles</div>';
    if(patientListEl) patientListEl.innerHTML = '';
    // clear search and sensitive inputs
    if(searchInput) searchInput.value = '';
    // optionally re-render an empty list so UI shows "No hay pacientes..." when next login happens
    try{ renderPatientList(); }catch(e){ /* safe */ }
    // ensure main registration area is visible (usually it's visible by default under panel)
    const mainContainer = document.querySelector('.container');
    if(mainContainer) mainContainer.style.filter = '';
  }

  // expose init and some helpers
  function init(){
    // wire search
    if(btnSearch) btnSearch.addEventListener('click', ()=> renderPatientList(searchInput.value.trim()));
    if(searchInput) searchInput.addEventListener('keydown', (e)=> { if(e.key === 'Enter') renderPatientList(searchInput.value.trim()); });

    if(btnViewActive) btnViewActive.addEventListener('click', ()=> setListFilter('active'));
    if(btnViewEgresados) btnViewEgresados.addEventListener('click', ()=> setListFilter('discharged'));

    // UPDATED logout handler: hide panel, clear UI, close modals, and do NOT show login modal
    if(btnLogout) btnLogout.addEventListener('click', ()=> {
      try{
        auth.logout(); // removes session + emits eseb:logout
      }catch(e){
        console.warn('Error during logout', e);
      }
      // immediate UI cleanup without opening login modal
      handleLogoutUI();
    });

    // listen to changes in models to refresh UI
    window.addEventListener('eseb:storage', ()=> {
      if(panelStaff && !panelStaff.classList.contains('hidden')){
        renderPatientList(searchInput.value.trim());
        const detailWrap = patientDetailEl.querySelector('[data-patient-id]');
        if(detailWrap){
          const pid = detailWrap.getAttribute('data-patient-id');
          const p = patientsApi.getPatients().find(x=> x.id === pid);
          if(p) showPatientDetail(pid);
        }
      }
    });

    // also listen to domain events for immediate UI updates
    window.addEventListener('eseb:patient:created', ()=> renderPatientList(searchInput.value.trim()));
    window.addEventListener('eseb:patient:updated', ()=> {
      renderPatientList(searchInput.value.trim());
      const detailWrap = patientDetailEl.querySelector('[data-patient-id]');
      if(detailWrap){
        const pid = detailWrap.getAttribute('data-patient-id');
        const p = patientsApi.getPatients().find(x=> x.id === pid);
        if(p) showPatientDetail(pid);
      }
    });

    // react to logout events emitted elsewhere: perform same UI cleanup, DO NOT open login modal
    window.addEventListener('eseb:logout', ()=> {
      handleLogoutUI();
    });

    // initial render
    renderPatientList();
  }

  window.eseb = window.eseb || {};
  window.eseb.staffPanel = {
    init,
    renderPatientList,
    showPatientDetail
  };
})();
