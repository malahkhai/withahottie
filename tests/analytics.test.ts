import test from 'node:test';
import assert from 'node:assert/strict';
import { pageGroup, readChoice } from '../lib/analytics/model.ts';
test('analytics masks creator handles and private routes', () => {
 assert.equal(pageGroup('/@someone'), 'creator_profile');
 assert.equal(pageGroup('/creator/inbox/private-id'), 'creator_conversation');
 assert.equal(pageGroup('/auth/callback'), 'other');
 assert.equal(pageGroup('/creator/dashboard'), 'creator_dashboard');
 assert.equal(pageGroup('/unexpected/private'), 'other');
});
test('consent defaults to unknown and expires after 180 days', () => {
 const now=200*86400000;
 for(const raw of [null,'bad','{}',JSON.stringify({accepted:true,at:0}),JSON.stringify({accepted:true,at:now+1})]) assert.equal(readChoice(raw,now),null);
 assert.equal(readChoice(JSON.stringify({accepted:false,at:now}),now),false);
 assert.equal(readChoice(JSON.stringify({accepted:true,at:now}),now),true);
});
