// ============================================================================
// Firebase adapter — the real backend. Same interface as demo.js.
// Security is enforced by firestore.rules on Google's servers.
// ============================================================================
const V = '12.19.0';
const base = `https://www.gstatic.com/firebasejs/${V}`;

export async function createFirebaseStore(cfg) {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const app = initializeApp(cfg.firebase);
  const auth = A.getAuth(app);
  let db;
  try {
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) {
    db = F.getFirestore(app); // private mode / no IndexedDB → memory cache
  }
  if (cfg.emulator) {
    A.connectAuthEmulator(auth, `http://${cfg.emulator}:9099`, { disableWarnings: true });
    F.connectFirestoreEmulator(db, cfg.emulator, 8080);
  }
  const coachEmail = String(cfg.coachEmail || '').trim().toLowerCase();
  const toUser = (u) => u && ({
    uid: u.uid, email: u.email || '', verified: !!u.emailVerified,
    isCoach: !!coachEmail && (u.email || '').toLowerCase() === coachEmail,
  });
  const ref = (p) => F.doc(db, p);
  const conv = (v) => (v === DEL ? F.deleteField() : v);
  const DEL = { __del: true };
  const mapDel = (o) => {
    if (o === DEL) return F.deleteField();
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      const r = {}; for (const [k, v] of Object.entries(o)) r[k] = mapDel(v); return r;
    }
    return o;
  };
  const fsErr = (e) => ({ code: e && e.code ? String(e.code).replace('firestore/', '') : 'unavailable', message: (e && e.message) || String(e) });
  const authErr = (e) => {
    const c = (e && e.code) || '';
    const map = {
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/wrong-password': 'Email or password is incorrect.',
      'auth/user-not-found': 'No account with that email.',
      'auth/email-already-in-use': 'That email already has an account. Try signing in.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/invalid-email': 'That email address looks wrong.',
      'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
      'auth/network-request-failed': 'No connection. Check your internet.',
    };
    return new Error(map[c] || (e && e.message) || 'Something went wrong.');
  };
  const snapToObj = (s) => ({ id: s.id, ...s.data() });

  return {
    mode: 'firebase',
    DEL,
    id: () => F.doc(F.collection(db, '_')).id,
    onAuth(cb) { return A.onAuthStateChanged(auth, (u) => cb(toUser(u))); },
    async signIn(email, pw) { try { await A.signInWithEmailAndPassword(auth, email.trim(), pw); } catch (e) { throw authErr(e); } },
    async signUp(email, pw) {
      try {
        const c = await A.createUserWithEmailAndPassword(auth, email.trim(), pw);
        if (toUser(c.user).isCoach) await A.sendEmailVerification(c.user).catch(() => {});
      } catch (e) { throw authErr(e); }
    },
    async signOut() { await A.signOut(auth); },
    async resetPassword(email) { try { await A.sendPasswordResetEmail(auth, email.trim()); } catch (e) { throw authErr(e); } },
    async sendVerify() { if (auth.currentUser) await A.sendEmailVerification(auth.currentUser); },
    async refreshUser() {
      if (!auth.currentUser) return null;
      await auth.currentUser.reload(); await auth.currentUser.getIdToken(true);
      return toUser(auth.currentUser);
    },
    watchDoc(path, cb, onErr) {
      return F.onSnapshot(ref(path), (s) => cb(s.exists() ? s.data() : null, { cache: s.metadata.fromCache, pending: s.metadata.hasPendingWrites }), (e) => onErr && onErr(fsErr(e)));
    },
    watchCol(path, opts, cb, onErr) {
      let q = F.collection(db, path);
      const parts = [];
      if (opts && opts.orderBy) parts.push(F.orderBy(opts.orderBy, opts.dir || 'asc'));
      if (opts && opts.limit) parts.push(F.limit(opts.limit));
      if (parts.length) q = F.query(q, ...parts);
      return F.onSnapshot(q, (s) => cb(s.docs.map(snapToObj), { cache: s.metadata.fromCache }), (e) => onErr && onErr(fsErr(e)));
    },
    watchGroup(name, cb, onErr) {
      return F.onSnapshot(F.query(F.collectionGroup(db, name)), (s) => cb(s.docs.map((d) => ({
        id: d.id, uid: d.ref.parent.parent ? d.ref.parent.parent.id : null, ...d.data(),
      }))), (e) => onErr && onErr(fsErr(e)));
    },
    async get(path) { const s = await F.getDoc(ref(path)); return s.exists() ? s.data() : null; },
    async getCol(path, opts) {
      let q = F.collection(db, path); const parts = [];
      if (opts && opts.orderBy) parts.push(F.orderBy(opts.orderBy, opts.dir || 'asc'));
      if (opts && opts.before !== undefined) parts.push(F.where(opts.orderBy, '<', opts.before));
      if (opts && opts.limit) parts.push(F.limit(opts.limit));
      if (parts.length) q = F.query(q, ...parts);
      const s = await F.getDocs(q); return s.docs.map(snapToObj);
    },
    set: (path, data) => F.setDoc(ref(path), mapDel(data)),
    merge: (path, data) => F.setDoc(ref(path), mapDel(data), { merge: true }),
    update(path, data) {
      const d = {}; for (const [k, v] of Object.entries(data)) d[k] = conv(v);
      return F.updateDoc(ref(path), d);
    },
    del: (path) => F.deleteDoc(ref(path)),
    async batch(ops) {
      const b = F.writeBatch(db);
      for (const o of ops) {
        if (o.op === 'set') b.set(ref(o.path), mapDel(o.data));
        else if (o.op === 'merge') b.set(ref(o.path), mapDel(o.data), { merge: true });
        else if (o.op === 'update') { const d = {}; for (const [k, v] of Object.entries(o.data)) d[k] = conv(v); b.update(ref(o.path), d); }
        else if (o.op === 'delete') b.delete(ref(o.path));
      }
      await b.commit();
    },
  };
}
