/**
 * Firebase — READ-ONLY access to the shared `unico-operations` project.
 * ──────────────────────────────────────────────────────────────────────────
 * This dashboard NEVER writes to Firestore. It only reads data the factory
 * apps (welder / plating / plastic / attendance) already produce, so it can
 * never corrupt production data.
 *
 * The web config below is NOT secret — Firebase web keys are meant to ship in
 * the browser. Security comes from Firestore Rules + the Google-login
 * allowlist below, not from hiding these values.
 */
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore'
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from 'firebase/auth'

export const firebaseConfig = {
  apiKey:            'AIzaSyCK0M-EfmOp9nh1-ZJcrBqT7c4plNxL2FM',
  authDomain:        'unico-operations.firebaseapp.com',
  projectId:         'unico-operations',
  storageBucket:     'unico-operations.firebasestorage.app',
  messagingSenderId: '367786260524',
  appId:             '1:367786260524:web:ae49d5da0ef1a71a9e3989',
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
const auth = getAuth(app)

/**
 * Who may open the CEO dashboard. Add a manager's Google email here (lowercase)
 * to grant access — owner + senior staff only. Everyone else is blocked even
 * after a successful Google sign-in.
 */
export const ACCESS_ALLOWLIST = [
  'nspenterprises24@gmail.com',   // Owner / bootstrap admin — sign in with THIS account
  // Add a manager's Google email here later, e.g. 'anshulgoel5884@gmail.com'.
  // NOTE: attendance (salary) data is owner-only at the Firestore-rules level, so a
  // manager would see Production/Pending but the Manpower tile would stay empty
  // until those rules are widened.
]
export const isAllowed = (email) =>
  !!email && ACCESS_ALLOWLIST.includes(email.toLowerCase())

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const cred = await signInWithPopup(auth, provider)
  return (cred.user.email || '').toLowerCase()
}
export const signOutUser = () => signOut(auth).catch(() => {})
export const watchAuth = (cb) => onAuthStateChanged(auth, cb)

/** Read every doc in apps/{ns}/{coll}. */
export async function readColl(ns, coll) {
  const snap = await getDocs(collection(db, 'apps', ns, coll))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
/** Read apps/{ns}/{coll} filtered to one date (YYYY-MM-DD) on the `date` field. */
export async function readByDate(ns, coll, dateStr) {
  const q = query(collection(db, 'apps', ns, coll), where('date', '==', dateStr))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
/** Read a top-level collection (attendance uses att_* at the root). */
export async function readRoot(coll) {
  const snap = await getDocs(collection(db, coll))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
