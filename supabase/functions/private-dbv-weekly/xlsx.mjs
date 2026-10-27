// Restricted XLSX XML reader for the official DBV export. Pure; ZIP inflation is
// done by the Edge adapter with an explicit entry allowlist and size limits.
const DECODER=new TextDecoder("utf-8",{fatal:true});
const MAX_XML=65_000_000;
function asXml(value) {
  const s=typeof value==="string"?value:DECODER.decode(value);
  if(s.length>MAX_XML||/<!DOCTYPE|<!ENTITY/i.test(s))throw Error("xlsx_xml_rejected");
  return s;
}
function decodeXml(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,entity)=>{
    if(entity[0]==="#") {
      const cp=entity[1].toLowerCase()==="x"?
        parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);
      if(!Number.isInteger(cp)||cp<1||cp>0x10ffff||cp>=0xd800&&cp<=0xdfff)
        throw Error("xlsx_xml_entity");
      return String.fromCodePoint(cp);
    }
    return {amp:"&",lt:"<",gt:">",quot:'"',apos:"'"}[entity.toLowerCase()];
  });
}
function texts(xml) {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map(m=>decodeXml(m[1])).join("");
}
function sharedStrings(xml) {
  if(!xml)return [];
  const s=asXml(xml),out=[];
  for(const match of s.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)) {
    out.push(texts(match[1]));
    if(out.length>150000)throw Error("xlsx_shared_strings_limit");
  }
  return out;
}
function colIndex(reference) {
  let n=0;
  for(const c of reference.toUpperCase())n=n*26+c.charCodeAt(0)-64;
  return n-1;
}
function cells(row,shared) {
  const result=new Map();
  let implicit=0;
  const pattern=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  for(const match of row.matchAll(pattern)) {
    const attrs=match[1],body=match[2]||"";
    const ref=/\br=["']([A-Z]{1,3})\d+["']/i.exec(attrs);
    const type=/\bt=["']([^"']+)["']/i.exec(attrs)?.[1]||"";
    const col=ref?colIndex(ref[1]):implicit;
    implicit=col+1;
    if(col<0||col>256)continue;
    if(/<f(?:\s|>)/.test(body))throw Error("xlsx_formula_cell");
    const value=/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1];
    let decoded;
    if(type==="s") {
      const idx=Number(value);
      if(!Number.isInteger(idx)||idx<0||idx>=shared.length)throw Error("xlsx_string_index");
      decoded=shared[idx];
    } else if(type==="inlineStr")decoded=texts(body);
    else decoded=value===undefined?"":decodeXml(value);
    result.set(col,decoded);
  }
  return result;
}
function cleanHeader(s) {
  return String(s||"").trim().toLowerCase().replace(/\s+/g,"");
}
function parsePoints(value) {
  if(typeof value==="number")return value;
  let s=String(value??"").trim().replace(/\u00a0|\s/g,"");
  if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");
  else if(/^-?\d{1,3}(?:\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
  const n=Number(s);
  return s&&Number.isFinite(n)?n:null;
}
function sheetRows(xml,shared,out) {
  const s=asXml(xml);
  let header=null,seen=0;
  for(const match of s.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    seen++;
    if(seen>130000)throw Error("xlsx_row_limit");
    const row=cells(match[1],shared);
    if(!header) {
      const map=new Map([...row].map(([idx,val])=>[cleanHeader(val),idx]));
      if(map.has("ranglistenplatz")&&!map.has("rang"))map.set("rang",map.get("ranglistenplatz"));
      if(map.has("points")&&!map.has("punkte"))map.set("punkte",map.get("points"));
      if(["dis","spielerid","gjahr","punkte"].every(x=>map.has(x)))header=map;
      else if(seen>45)break;
      continue;
    }
    const val=k=>row.get(header.get(k))??"";
    const discipline=String(val("dis")).trim().toUpperCase();
    const id=String(val("spielerid")).trim();
    const birthYear=Number(val("gjahr"));
    const points=parsePoints(val("punkte"));
    if(!["HE","HD","HM","DE","DD","DM"].includes(discipline)||
      !/^\d{2}-\d{6}$/.test(id)||!Number.isInteger(birthYear)||points===null)continue;
    const rawRank=Number(val("rang")),tournaments=Number(val("turniere")||0);
    out.push({id,discipline,birthYear,points,
      overallRank:Number.isInteger(rawRank)&&rawRank>0?rawRank:null,
      ageClass:String(val("akl2")).trim(),ageDetail:String(val("akl1")).trim(),
      gender:String(val("gs")).trim().toUpperCase(),
      association:String(val("lvname")).trim(),
      tournaments,firstName:String(val("vorname")).trim(),
      lastName:String(val("nachname")).trim(),
      club:String(val("verein")).trim(),clubId:String(val("clubid")).trim()});
    if(out.length>130000)throw Error("xlsx_row_limit");
  }
}
export function parseOfficialXlsxXml(files) {
  if(!files||typeof files!=="object")throw Error("xlsx_empty");
  const shared=sharedStrings(files["xl/sharedStrings.xml"]);
  const sheets=Object.keys(files).filter(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort();
  if(sheets.length<1||sheets.length>12)throw Error("xlsx_sheet_count");
  const rows=[];
  for(const name of sheets)sheetRows(files[name],shared,rows);
  if(rows.length<5000)throw Error("xlsx_row_coverage");
  return rows;
}
