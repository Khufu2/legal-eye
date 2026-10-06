/** Office adapters keep host mutations explicit and await their actual result. */
export function escapeReplyHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\r?\n/g, '<br>');
}

type AsyncResult = { status: string; value?: string; error?: { message?: string } };
type OfficeHost = {
  AsyncResultStatus: { Succeeded: string };
  CoercionType: { Text: string };
  context?: { mailbox?: { item?: any } };
};
export function outlookSubject(office: OfficeHost): Promise<string> {
  const subject = office.context?.mailbox?.item?.subject;
  if (typeof subject === 'string') return Promise.resolve(subject);
  if (!subject?.getAsync) return Promise.resolve('');
  return new Promise((resolve, reject) => {const timeout=setTimeout(()=>reject(new Error('Outlook subject request timed out')),15000);subject.getAsync((result: AsyncResult) => {
    clearTimeout(timeout);
    if (result.status === office.AsyncResultStatus.Succeeded) resolve(result.value || '');
    else reject(new Error(result.error?.message || 'Could not read the email subject'));
  });});
}
export function draftOutlookReply(office: OfficeHost, text: string): Promise<void> {
  const item = office.context?.mailbox?.item;
  return new Promise((resolve, reject) => {
    const timeout=setTimeout(()=>reject(new Error('Outlook insertion timed out. Check the draft before retrying.')),15000);
    const done = (result: AsyncResult) => {clearTimeout(timeout);return result.status === office.AsyncResultStatus.Succeeded
      ? resolve() : reject(new Error(result.error?.message || 'Outlook could not insert the draft'));};
    if (item?.displayReplyFormAsync) {
      item.displayReplyFormAsync({ htmlBody: escapeReplyHtml(text) }, done);
    } else if (item?.body?.setSelectedDataAsync) {
      // Compose mode: insert at the cursor, preserving the existing message and signature.
      item.body.setSelectedDataAsync(text, { coercionType: office.CoercionType.Text }, done);
    } else {clearTimeout(timeout);reject(new Error('This Outlook version does not support reply insertion. Copy the reviewed text into your draft.'));}
  });
}
export async function replaceWordSelection(word: any, expected: string, text: string, trackChanges = false) {
  if (!word) throw new Error('Open this taskpane inside Microsoft Word.');
  if (!expected.trim()) throw new Error('Load the Word selection before replacing it.');
  await word.run(async (context: any) => {
    const selection = context.document.getSelection();
    selection.load('text');
    await context.sync();
    if (selection.text !== expected) throw new Error('The Word selection changed. Select the original text again, or load the new selection and regenerate.');
    if(trackChanges){
      context.document.load('changeTrackingMode');
      await context.sync();
      const previous=context.document.changeTrackingMode;
      try{context.document.changeTrackingMode='TrackAll';await context.sync();selection.insertText(text,'Replace');await context.sync();}
      finally{context.document.changeTrackingMode=previous;await context.sync();}
    }else{selection.insertText(text, 'Replace');await context.sync();}
  });
}

/** Read current-item text only; never enumerates mailboxes or sends mail. */
export function outlookItemText(office: OfficeHost): Promise<string> {
  return new Promise((resolve,reject)=>{
    const item=office.context?.mailbox?.item;
    if(!item?.body?.getAsync)return reject(new Error('Open this taskpane on an Outlook message.'));
    const timeout=setTimeout(()=>reject(new Error('Outlook did not respond. Reload the current item and retry.')),15000);
    item.body.getAsync(office.CoercionType.Text,(result:AsyncResult)=>{
      clearTimeout(timeout);
      if(result.status===office.AsyncResultStatus.Succeeded)resolve(String(result.value||''));
      else reject(new Error(result.error?.message||'Could not read the message'));
    });
  });
}
export async function checkedOutlookReply(office:OfficeHost,expected:string,text:string,expectedItemId?:string){
  if(!expected.trim())throw new Error('Load the current email before inserting a reply.');
  const item=office.context?.mailbox?.item;
  const current=await outlookItemText(office);
  if(item!==office.context?.mailbox?.item||current!==expected||(expectedItemId&&item?.itemId!==expectedItemId))throw new Error('The current email changed. Load it again and regenerate before inserting.');
  await draftOutlookReply(office,text);
}
export function officeDiagnostics(office:any,expectedHost:string){
 const req=office?.context?.requirements;
 return {checked_at:new Date().toISOString(),expected_host:expectedHost,platform:office?.context?.platform??'unknown',word_api_1_1:!!req?.isSetSupported?.('WordApi','1.1'),word_track_changes_1_4:!!req?.isSetSupported?.('WordApi','1.4'),mailbox_1_8:!!req?.isSetSupported?.('Mailbox','1.8'),native_host_acceptance:'pending',content_included:false};
}
