// main.js
(function(){
  const utils = window.eseb && window.eseb.utils;
  const storage = window.eseb && window.eseb.storage;
  const auth = window.eseb && window.eseb.auth;
  const patientsApi = window.eseb && window.eseb.patients;
  const modals = window.eseb && window.eseb.modals;
  const staffPanel = window.eseb && window.eseb.staffPanel;
  if(!utils || !storage || !auth || !patientsApi || !modals || !staffPanel) {
    console.warn('Algunos módulos no están cargados todavía. Asegúrate de incluirlos en el orden correcto.');
  }

  // wire registration form to patientsApi + registration modal
  const formRegister = document.getElementById('form-register');
  const registerResult = document.getElementById('register-result');
  const btnClear = document.getElementById('btn-clear');

  if(formRegister){
    formRegister.addEventListener('submit', (ev)=>{
      ev.preventDefault();
      const name = document.getElementById('p_name').value.trim();
      const doc = document.getElementById('p_doc').value.trim();
      const phone = document.getElementById('p_phone').value.trim();
      const reason = document.getElementById('p_reason').value.trim();
      const notes = document.getElementById('p_notes').value.trim();
      if(!name || !reason){ alert('Nombre y motivo son requeridos'); return; }

      const patient = patientsApi.createPatient({ name, doc, phone, reason, notes });
      // show IG modal with public code
      if(modals && modals.openRegistered){
        modals.openRegistered(patient.publicCode);
      } else {
        // fallback
        if(registerResult) {
          registerResult.style.display = 'block';
          registerResult.innerHTML = `<strong>Registro recibido</strong>. Código público: <code>${utils.escapeHtml(patient.publicCode)}</code>`;
        }
      }
      formRegister.reset();
      // render updated list
      if(staffPanel && typeof staffPanel.renderPatientList === 'function') staffPanel.renderPatientList();
    });
  }

  if(btnClear){
    btnClear.addEventListener('click', ()=> { if(formRegister) formRegister.reset(); });
  }

  // staff login open button(s) wiring: either open-login-staff or open-login-med / admin depending HTML
  const openLoginStaffBtn = document.getElementById('open-login-staff') || document.getElementById('open-login-med');
  if(openLoginStaffBtn){
    openLoginStaffBtn.addEventListener('click', ()=>{
      const loginModal = document.getElementById('modal-login');
      if(loginModal) {
        loginModal.classList.remove('hidden');
        // clear fields for security
        const lu = document.getElementById('login-username');
        const lp = document.getElementById('login-password');
        if(lu) lu.value = '';
        if(lp) lp.value = '';
      }
    });
  }

  // CLOSE handler for login modal (fix #2)
  const btnCancelLogin = document.getElementById('btn-cancel-login');
  if(btnCancelLogin){
    btnCancelLogin.addEventListener('click', ()=> {
      const loginModal = document.getElementById('modal-login');
      if(loginModal) loginModal.classList.add('hidden');
    });
  }

  // login form wiring (exists in index.html)
  const formLogin = document.getElementById('form-login');
  const formCreateUser = document.getElementById('form-create-user');
  if(formCreateUser){
    formCreateUser.addEventListener('submit', (ev)=>{
      ev.preventDefault();
      const u = document.getElementById('new-username').value.trim();
      const p = document.getElementById('new-password').value.trim();
      const r = document.getElementById('new-role').value;
      try{
        auth.saveUser(u,p,r);
        alert('Usuario creado localmente. Úsalo para iniciar sesión.');
        document.getElementById('new-username').value = '';
        document.getElementById('new-password').value = '';
      }catch(err){
        alert(err.message || 'Error creando usuario');
      }
    });
  }

  if(formLogin){
    formLogin.addEventListener('submit', (ev)=>{
      ev.preventDefault();
      const u = document.getElementById('login-username').value.trim();
      const p = document.getElementById('login-password').value.trim();
      const r = document.getElementById('login-role').value;
      const session = auth.loginUser(u,p,r);
      if(!session){ alert('Credenciales inválidas'); return; }
      // clear inputs for security
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      // close login modal
      const loginModal = document.getElementById('modal-login');
      if(loginModal) loginModal.classList.add('hidden');

      // open staff panel
      const panel = document.getElementById('panel-staff');
      if(panel){
        panel.classList.remove('hidden');
      }
      if(staffPanel && typeof staffPanel.init === 'function') staffPanel.init();
    });
  }

  // initialize staff panel automatically if session exists
  window.addEventListener('load', ()=> {
    const sess = auth.currentSession();
    if(sess){
      // show panel, init UI
      const panel = document.getElementById('panel-staff');
      if(panel) panel.classList.remove('hidden');
      if(staffPanel && typeof staffPanel.init === 'function') staffPanel.init();
    } else {
      // ensure default render of patient list exists (guest)
      if(staffPanel && typeof staffPanel.renderPatientList === 'function') staffPanel.renderPatientList();
    }
  });

})();
