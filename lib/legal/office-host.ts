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
  return new Promise((resolve, reject) => subject.getAsync((result: AsyncResult) => {
    if (result.status === office.AsyncResultStatus.Succeeded) resolve(result.value || '');
    else reject(new Error(result.error?.message || 'Could not read the email subject'));
  }));
}
export function draftOutlookReply(office: OfficeHost, text: string): Promise<void> {
  const item = office.context?.mailbox?.item;
  return new Promise((resolve, reject) => {
    const done = (result: AsyncResult) => result.status === office.AsyncResultStatus.Succeeded
      ? resolve() : reject(new Error(result.error?.message || 'Outlook could not insert the draft'));
    if (item?.displayReplyFormAsync) {
      item.displayReplyFormAsync({ htmlBody: escapeReplyHtml(text) }, done);
    } else if (item?.body?.setSelectedDataAsync) {
      // Compose mode: insert at the cursor, preserving the existing message and signature.
      item.body.setSelectedDataAsync(text, { coercionType: office.CoercionType.Text }, done);
    } else reject(new Error('This Outlook version does not support reply insertion. Copy the reviewed text into your draft.'));
  });
}
export async function replaceWordSelection(word: any, expected: string, text: string) {
  if (!word) throw new Error('Open this taskpane inside Microsoft Word.');
  if (!expected.trim()) throw new Error('Load the Word selection before replacing it.');
  await word.run(async (context: any) => {
    const selection = context.document.getSelection();
    selection.load('text');
    await context.sync();
    if (selection.text !== expected) throw new Error('The Word selection changed. Select the original text again, or load the new selection and regenerate.');
    selection.insertText(text, 'Replace');
    await context.sync();
  });
}
