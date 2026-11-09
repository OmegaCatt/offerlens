import test from 'node:test';import assert from 'node:assert/strict';
import {validateRequirement,decodeWorkspace} from '../web/workspace.mjs';
import {requirement,demoOffers} from '../web/fixtures.mjs';
test('workspace restores custom requirements and never trusts prior approvals',()=>{
 const custom={...requirement,maxDays:30};const saved=decodeWorkspace(JSON.stringify({format:'offerlens-workspace',version:1,requirements:custom,offers:demoOffers}));
 assert.equal(saved.requirements.maxDays,30);assert.ok(saved.offers.every(o=>!o.reviewed&&o.productMatch===null));
});
test('requirements reject incomplete and unbounded numeric fields',()=>{
 for(const change of [{quantity:0},{budgetHalers:NaN},{maxDays:1.5},{currency:'EUR'},{product:'  '}])assert.throws(()=>validateRequirement({...requirement,...change}));
});
