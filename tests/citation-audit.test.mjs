import test from 'node:test';
import assert from 'node:assert/strict';
import {auditResearchCitations,evidenceLabels} from '../lib/legal/citation-audit.ts';
test('grouped and page-qualified citations remain inspectable and unknown labels still fail',()=>{
 assert.deepEqual(evidenceLabels('Rule [P1, P2, F1]. Other [P1 Page 38].'),['P1','P2','F1']);
 const good=auditResearchCitations('Rule [P1, P2].',[{content:'Rule'},{content:'Rule'}],[]);
 assert.equal(good.passed,true);assert.equal(good.warnings.length,0);
 const bad=auditResearchCitations('Rule [P1, P99 Page 3].',[{content:'Rule'}],[]);
 assert.deepEqual(bad.unknownLabels,['P99']);assert.equal(bad.passed,false);
});
test('unknown authority labels fail without treating a known label as legal verification',()=>{
 const audit=auditResearchCitations('The rule applies [P1], and another rule [P99].',[{content:'A rule.'}],[]);
 assert.deepEqual(audit.unknownLabels,['P99']);assert.equal(audit.passed,false);assert.equal(audit.currentnessVerified,false);
});
test('verbatim quotation checks distinguish altered language and warn on OCR',()=>{
 const source='The recipient must preserve confidential information for thirty days.';
 const good=auditResearchCitations(`“${source}” [F1]`,[],[{content:source,ocr_requires_verification:true}]);
 assert.equal(good.unmatchedQuotationCount,0);assert.ok(good.warnings.some(w=>w.includes('OCR')));assert.equal(good.requiresLawyerReview,true);
 const bad=auditResearchCitations('“The recipient must disclose confidential information immediately.” [F1]',[],[{content:source}]);assert.equal(bad.unmatchedQuotationCount,1);
});
