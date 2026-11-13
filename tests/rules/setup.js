import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

export async function makeEnv() {
  return initializeTestEnvironment({
    projectId: 'demo-travel',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
}

export async function seed(env, path, data) {
  await env.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(path).set(data); });
}

export async function register(env, uid, name) {
  await seed(env, `people/${uid}`, { name, createdAt: new Date() });
  await seed(env, `devices/${uid}`, { personId: uid, via: 'self' });
}

export function as(env, uid) {
  return env.authenticatedContext(uid).firestore();
}

export function tripData(ownerId, extra = {}) {
  return {
    name: '2027 상하이', destination: '상하이, 중국', fromCode: 'ICN', toCode: 'PVG',
    startDate: null, days: null, timeZone: 'Asia/Shanghai', countryCode: 'CN', currency: 'CNY',
    notes: '', ownerId, memberIds: [ownerId], createdAt: new Date(), ...extra,
  };
}
