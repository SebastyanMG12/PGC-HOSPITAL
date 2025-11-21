// doctors.js
(function(){
  const s = window.eseb && window.eseb.storage;
  const utils = window.eseb && window.eseb.utils;
  const audit = window.eseb && window.eseb.audit;
  if(!s || !utils || !audit) throw new Error('storage, utils and audit must be loaded before doctors.js');

  function initializeDoctors(){
    const existing = s.read(s.STORAGE_KEYS.DOCTORS);
    if(existing && Array.isArray(existing) && existing.length) return existing;
    const doctors = [
      { id: utils.uid('doc'), name: 'Ana María López Pérez', patients: [] },
      { id: utils.uid('doc'), name: 'Carlos Andrés Martínez Gómez', patients: [] },
      { id: utils.uid('doc'), name: 'Laura Valentina Ruiz Sánchez', patients: [] },
      { id: utils.uid('doc'), name: 'Diego Fernando Torres Ramírez', patients: [] },
      { id: utils.uid('doc'), name: 'María Fernanda Gómez Herrera', patients: [] }
    ];
    s.write(s.STORAGE_KEYS.DOCTORS, doctors);
    return doctors;
  }

  function getDoctors(){ return s.read(s.STORAGE_KEYS.DOCTORS) || []; }
  function saveDoctors(list){ s.write(s.STORAGE_KEYS.DOCTORS, list || []); window.dispatchEvent(new CustomEvent('eseb:doctors:changed', {})); }

  function assignPatientToDoctor(docId, patientId){
    const docs = getDoctors();
    const doc = docs.find(d=> d.id === docId);
    if(!doc) throw new Error('Doctor no encontrado');
    if(!doc.patients.includes(patientId)) doc.patients.push(patientId);
    saveDoctors(docs);
    audit.logAudit({ action:'assign_doctor', patientId, details: { docId, docName: doc.name } });
    return true;
  }

  function removePatientFromDoctor(docId, patientId){
    const docs = getDoctors();
    const doc = docs.find(d=> d.id === docId);
    if(!doc) return false;
    doc.patients = (doc.patients || []).filter(pid => pid !== patientId);
    saveDoctors(docs);
    audit.logAudit({ action:'remove_doctor_patient', patientId, details: { docId, docName: doc.name } });
    return true;
  }

  function getDoctorCounts(){
    return getDoctors().map(d=> ({ id: d.id, name: d.name, count: (d.patients || []).length }));
  }

  window.eseb = window.eseb || {};
  window.eseb.doctors = {
    initializeDoctors,
    getDoctors,
    saveDoctors,
    assignPatientToDoctor,
    removePatientFromDoctor,
    getDoctorCounts
  };

  // initialize default doctors if missing
  initializeDoctors();
})();
