export const practiceAreas = {
  employment: ['Employment','Ajira'],
  land: ['Land and housing','Ardhi na makazi'],
  family: ['Family','Familia'],
  business: ['Business and contracts','Biashara na mikataba'],
  disputes: ['Civil disputes','Migogoro ya madai'],
  estate: ['Wills and estates','Wosia na mirathi'],
  privacy: ['Data protection','Ulinzi wa taarifa binafsi'],
  criminal: ['Criminal law','Sheria ya jinai'],
} as const;

export type PracticeArea = keyof typeof practiceAreas;
export type PublicAdvocate = {
  id:string; name:string; firm:string; roll:string; city:string; areas:PracticeArea[]; checked_at:string;
};
export type PublicSource = {
  title:string; citation:string|null; publisher:string|null; url:string; excerpt:string; page:number|null;
};

const terms: [RegExp,string][] = [
  [/kufukuzwa|kufutwa kazi|kusitishwa kwa ajira|termination|dismissal/i,'unfair termination dismissal Employment Labour Relations Act'],
  [/mshahara|malipo ya kazi|wages|salary/i,'minimum wages remuneration Employment Labour Relations Act'],
  [/ajira|mwajiri|mfanyakazi|employment|employee/i,'Employment Labour Relations Act'],
  [/ardhi|kiwanja|hati miliki|land title|land dispute/i,'Land Act Village Land Act right occupancy'],
  [/mpangaji|pango|nyumba ya kupanga|tenant|lease/i,'land lease landlord tenant'],
  [/ndoa|talaka|matunzo ya mtoto|divorce|marriage|custody/i,'Law of Marriage Act divorce custody maintenance'],
  [/mirathi|wosia|urithi|probate|inheritance|will\b/i,'Probate Administration Estates Act wills inheritance'],
  [/mkataba|mikataba|contract/i,'Law of Contract Act agreement breach'],
  [/kampuni|usajili wa biashara|company|incorporation/i,'Companies Act company registration'],
  [/taarifa binafsi|faragha|data protection|privacy/i,'Personal Data Protection Act'],
  [/jinai|kukamatwa|dhamana|criminal|arrest|bail/i,'Criminal Procedure Act arrest bail'],
];

export function corpusQueries(query:string) {
  const expansion = terms.find(([pattern])=>pattern.test(query))?.[1];
  return expansion && expansion !== query ? [expansion,query] : [query];
}

export function officialSourceUrl(value:unknown) {
  if(typeof value!=='string')return null;
  try {
    const url=new URL(value);
    const approved=['oagmis.oag.go.tz','www.oag.go.tz','oag.go.tz','emaktaba.judiciary.go.tz','www.judiciary.go.tz','judiciary.go.tz','www.parliament.go.tz','parliament.go.tz'];
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&approved.includes(url.hostname)?url.href:null;
  }catch{return null;}
}
