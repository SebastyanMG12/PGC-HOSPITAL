// auth.js
(function(){
  const s = window.eseb && window.eseb.storage;
  const utils = window.eseb && window.eseb.utils;
  if(!s || !utils) throw new Error('storage.js and utils.js must be loaded before auth.js');

  function getUsers(){
    return s.read(s.STORAGE_KEYS.USERS) || [];
  }
  function saveUsers(list){
    s.write(s.STORAGE_KEYS.USERS, list || []);
  }

  function encodePassword(p){ return btoa(p); } // demo only
  function checkPassword(stored, plain){ return stored === encodePassword(plain); }

  function saveUser(username, password, role){
    const users = getUsers();
    if(users.some(u=>u.username === username)) throw new Error('Usuario ya existe');
    users.push({
      id: utils.uid('user'),
      username,
      password: encodePassword(password),
      role,
      created: utils.now()
    });
    saveUsers(users);
    s.write(s.STORAGE_KEYS.USERS, users);
    window.dispatchEvent(new CustomEvent('eseb:user:created', { detail: { username, role } }));
    return true;
  }

  function loginUser(username, password, role){
    const users = getUsers();
    const u = users.find(x=> x.username === username && x.role === role);
    if(!u) return null;
    if(!checkPassword(u.password, password)) return null;
    // create session
    const session = { userId: u.id, username: u.username, role: u.role, loggedAt: utils.now() };
    s.write(s.STORAGE_KEYS.SESSION, session);
    window.dispatchEvent(new CustomEvent('eseb:login', { detail: session }));
    return session;
  }

  function logout(){
    localStorage.removeItem(s.STORAGE_KEYS.SESSION);
    window.dispatchEvent(new CustomEvent('eseb:logout', {}));
  }

  function currentSession(){
    return s.read(s.STORAGE_KEYS.SESSION);
  }

  window.eseb = window.eseb || {};
  window.eseb.auth = {
    getUsers,
    saveUser,
    loginUser,
    logout,
    currentSession
  };
})();
