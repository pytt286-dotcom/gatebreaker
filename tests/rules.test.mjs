// Security-rules tests against the real Firestore emulator.
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, collectionGroup, query } from 'firebase/firestore';
import fs from 'node:fs';

const rules = fs.readFileSync('./firestore.rules', 'utf8').replaceAll('COACH_EMAIL_HERE', 'coach@test.com');
const env = await initializeTestEnvironment({ projectId: 'demo-pt', firestore: { rules, host: '127.0.0.1', port: 8080 } });
await env.clearFirestore();

const coach = env.authenticatedContext('coachUid', { email: 'coach@test.com', email_verified: true }).firestore();
const fakeCoach = env.authenticatedContext('fake', { email: 'coach@test.com', email_verified: false }).firestore();
const A = env.authenticatedContext('alice', { email: 'a@x.com' }).firestore();
const B = env.authenticatedContext('bob', { email: 'b@x.com' }).firestore();
const S = env.authenticatedContext('stranger', { email: 's@x.com' }).firestore();
const anon = env.unauthenticatedContext().firestore();

let pass = 0, fail = 0;
async function t(name, p) {
  try { await p; pass++; console.log('  ok  ', name); }
  catch (e) { fail++; console.log('  FAIL', name, '—', e.message.split('\n')[0]); }
}

// coach setup
await t('coach writes invite code', assertSucceeds(setDoc(doc(coach, 'coachPrivate/settings'), { inviteCode: 'ARISE' })));
await t('unverified "coach" email is NOT coach', assertFails(setDoc(doc(fakeCoach, 'coachPrivate/settings'), { inviteCode: 'HACK' })));
await t('coach public card', assertSucceeds(setDoc(doc(coach, 'coach/profile'), { name: 'Pytt' })));
await t('client reads coach card', assertSucceeds(getDoc(doc(A, 'coach/profile'))));
await t('anon cannot read coach card', assertFails(getDoc(doc(anon, 'coach/profile'))));
await t('client cannot read invite code', assertFails(getDoc(doc(A, 'coachPrivate/settings'))));

// joining
await t('join with wrong invite fails', assertFails(setDoc(doc(S, 'clients/stranger'), { name: 'S', invite: 'nope' })));
await t('join without invite fails', assertFails(setDoc(doc(S, 'clients/stranger'), { name: 'S' })));
await t('stranger cannot write food before joining', assertFails(setDoc(doc(S, 'clients/stranger/days/2026-11-24'), { entries: {} })));
await t('alice joins with code (case-insensitive)', assertSucceeds(setDoc(doc(A, 'clients/alice'), { name: 'Alice', invite: 'arise' })));
await t('bob joins', assertSucceeds(setDoc(doc(B, 'clients/bob'), { name: 'Bob', invite: 'ARISE' })));
await t('alice cannot create a profile for someone else', assertFails(setDoc(doc(A, 'clients/eve'), { name: 'Eve', invite: 'ARISE' })));
await t('alice cannot change her invite field', assertFails(updateDoc(doc(A, 'clients/alice'), { invite: 'X' })));
await t('alice updates her profile', assertSucceeds(updateDoc(doc(A, 'clients/alice'), { deficit: 500 })));

// own channel
await t('alice logs food', assertSucceeds(setDoc(doc(A, 'clients/alice/days/2026-11-24'), { entries: { e1: { name: 'Rice', kcal: 200 } } })));
await t('alice writes note', assertSucceeds(setDoc(doc(A, 'clients/alice/notes/n1'), { body: 'hi' })));
await t('alice writes summary', assertSucceeds(setDoc(doc(A, 'clients/alice/summary/2026'), { days: {} })));
await t('alice writes status', assertSucceeds(setDoc(doc(A, 'clients/alice/status/client'), { lastActive: 1 })));
await t('alice reads own food', assertSucceeds(getDoc(doc(A, 'clients/alice/days/2026-11-24'))));

// privacy between clients
await t('bob CANNOT read alice profile', assertFails(getDoc(doc(B, 'clients/alice'))));
await t('bob CANNOT read alice food', assertFails(getDoc(doc(B, 'clients/alice/days/2026-11-24'))));
await t('bob CANNOT list alice notes', assertFails(getDocs(collection(B, 'clients/alice/notes'))));
await t('bob CANNOT write into alice channel', assertFails(setDoc(doc(B, 'clients/alice/notes/x'), { body: 'spy' })));
await t('bob CANNOT list all clients', assertFails(getDocs(collection(B, 'clients'))));
await t('bob CANNOT collection-group status', assertFails(getDocs(query(collectionGroup(B, 'status')))));
await t('bob CANNOT collection-group summary', assertFails(getDocs(query(collectionGroup(B, 'summary')))));
await t('bob CANNOT collection-group days', assertFails(getDocs(query(collectionGroup(B, 'days')))));
await t('bob CANNOT read alice plan', assertFails(getDoc(doc(B, 'plans/alice'))));
await t('anon CANNOT read alice', assertFails(getDoc(doc(anon, 'clients/alice/days/2026-11-24'))));

// plans (coach-only basis)
await t('coach sets alice plan', assertSucceeds(setDoc(doc(coach, 'plans/alice'), { metrics: [{ id: 'weight', freq: 'daily' }] })));
await t('alice reads her plan', assertSucceeds(getDoc(doc(A, 'plans/alice'))));
await t('alice CANNOT change her plan', assertFails(updateDoc(doc(A, 'plans/alice'), { metrics: [] })));
await t('alice CANNOT create her plan', assertFails(setDoc(doc(A, 'plans/bob'), { metrics: [] })));

// coach private notes
await t('coach writes private note', assertSucceeds(setDoc(doc(coach, 'coachNotes/alice'), { body: 'knee injury' })));
await t('alice CANNOT read coach private note', assertFails(getDoc(doc(A, 'coachNotes/alice'))));

// chat
await t('alice sends message as client', assertSucceeds(setDoc(doc(A, 'clients/alice/messages/m1'), { from: 'client', text: 'hi coach', at: 1 })));
await t('alice CANNOT impersonate coach', assertFails(setDoc(doc(A, 'clients/alice/messages/m2'), { from: 'coach', text: 'fake', at: 2 })));
await t('coach sends message', assertSucceeds(setDoc(doc(coach, 'clients/alice/messages/m3'), { from: 'coach', text: 'Session 5pm', at: 3 })));
await t('alice CANNOT delete coach message', assertFails(deleteDoc(doc(A, 'clients/alice/messages/m3'))));
await t('alice deletes own message', assertSucceeds(deleteDoc(doc(A, 'clients/alice/messages/m1'))));
await t('bob CANNOT read alice chat', assertFails(getDocs(collection(B, 'clients/alice/messages'))));
await t('message over 4000 chars rejected', assertFails(setDoc(doc(A, 'clients/alice/messages/m4'), { from: 'client', text: 'x'.repeat(4001), at: 4 })));

// coach sees everything
await t('coach lists clients', assertSucceeds(getDocs(collection(coach, 'clients'))));
await t('coach collection-group status', assertSucceeds(getDocs(query(collectionGroup(coach, 'status')))));
await t('coach collection-group summary', assertSucceeds(getDocs(query(collectionGroup(coach, 'summary')))));
await t('coach reads alice food', assertSucceeds(getDoc(doc(coach, 'clients/alice/days/2026-11-24'))));
await t('coach edits alice note', assertSucceeds(setDoc(doc(coach, 'clients/alice/notes/n1'), { body: 'edited by coach' })));
await t('client cannot delete own profile', assertFails(deleteDoc(doc(A, 'clients/alice'))));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
