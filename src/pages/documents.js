/* ════════════════════════════════════════════════════════════════════════════
   LOCATION DOCUMENTS

   Folders and files that belong to a location — contracts, licences, floor plans,
   whatever that site needs to keep. Rows live in the new tm_folders / tm_documents
   tables; the bytes live in the private tm-location-docs bucket and are served
   through short-lived signed URLs, never a public link.

   Access follows the Locations permission area: view a location → see its files;
   Locations → Create/Edit to upload and make folders; Locations → Delete to remove.
   ════════════════════════════════════════════════════════════════════════════ */

const DOC_MAX_BYTES=25*1024*1024; // matches the bucket's own limit, checked before the upload starts

function _mFolder(rows){return(rows||[]).map(f=>({id:f.id,locationId:f.location_id,parentId:f.parent_id||null,name:f.name||'',createdBy:f.created_by||null,createdAt:f.created_at}));}
function _folderRow(f){return{id:f.id,location_id:f.locationId,parent_id:f.parentId||null,name:f.name||'',created_by:f.createdBy||null,created_at:f.createdAt||new Date().toISOString()};}
function _mDoc(rows){return(rows||[]).map(d=>({id:d.id,locationId:d.location_id,folderId:d.folder_id||null,name:d.name||'',storagePath:d.storage_path||'',fileType:d.file_type||'',fileSize:Number(d.file_size)||0,uploadedBy:d.uploaded_by||null,uploaderName:d.uploader_name||'',uploadedAt:d.uploaded_at}));}
function _docRow(d){return{id:d.id,location_id:d.locationId,folder_id:d.folderId||null,name:d.name||'',storage_path:d.storagePath||'',file_type:d.fileType||'',file_size:d.fileSize||0,uploaded_by:d.uploadedBy||null,uploader_name:d.uploaderName||'',uploaded_at:d.uploadedAt||new Date().toISOString()};}

async function _docsLoad(){
  try{
    const [f,d]=await Promise.all([
      sb.from('tm_folders').select('*').order('created_at',{ascending:true}),
      sb.from('tm_documents').select('*').order('uploaded_at',{ascending:false}),
    ]);
    if(!f.error)DB.tmFolders=_mFolder(f.data);
    if(!d.error)DB.tmDocuments=_mDoc(d.data);
  }catch(e){console.warn('[location docs] load skipped:',e&&e.message);}
}

const _fmtBytes=n=>{n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(0)+' KB';return (n/1048576).toFixed(1)+' MB';};
const _foldersIn=(locId,parentId)=>(DB.tmFolders||[]).filter(f=>f.locationId===locId&&(f.parentId||null)===(parentId||null)).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
const _docsIn=(locId,folderId)=>(DB.tmDocuments||[]).filter(d=>d.locationId===locId&&(d.folderId||null)===(folderId||null)).sort((a,b)=>String(b.uploadedAt||'').localeCompare(String(a.uploadedAt||'')));
/* Breadcrumb trail from the location root down to `folderId`. */
function _folderTrail(folderId){
  const out=[];let g=0;let cur=folderId?(DB.tmFolders||[]).find(f=>f.id===folderId):null;
  while(cur&&g++<12){out.unshift(cur);cur=cur.parentId?(DB.tmFolders||[]).find(f=>f.id===cur.parentId):null;}
  return out;
}
/* Every folder id at or beneath `folderId` — used so deleting a folder can take its subtree. */
function _folderSubtree(locId,folderId){
  const out=[folderId];
  let frontier=[folderId],g=0;
  while(frontier.length&&g++<20){
    const next=(DB.tmFolders||[]).filter(f=>f.locationId===locId&&frontier.includes(f.parentId)).map(f=>f.id);
    out.push(...next);frontier=next;
  }
  return out;
}

/* ── the Documents tab on a location ── */
function _locDocsTab(locId){
  const canUp=can('locations','create')||can('locations','edit')||isAdmin();
  const canDel=can('locations','delete')||isAdmin();
  const fid=S.filters.docFolder||null;
  const trail=_folderTrail(fid);
  const folders=_foldersIn(locId,fid);
  const docs=_docsIn(locId,fid);
  const loc=locById(locId);

  const crumbs=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;flex-wrap:wrap">
    <button type="button" onclick="App._docFolder(null)" style="font-size:13px;font-weight:700;color:${fid?'var(--c-brand-ink)':'var(--c-text)'};background:none;border:none;cursor:pointer;padding:0">${esc((loc&&loc.name)||'Location')}</button>
    ${trail.map((f,i)=>`<span style="color:var(--c-text-3)">›</span><button type="button" onclick="App._docFolder('${esc(f.id)}')" style="font-size:13px;font-weight:${i===trail.length-1?'800':'700'};color:${i===trail.length-1?'var(--c-text)':'var(--c-brand-ink)'};background:none;border:none;cursor:pointer;padding:0">${esc(f.name)}</button>`).join('')}
  </div>`;

  const toolbar=canUp?`<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
    ${btn('New folder',`App._docNewFolder('${esc(locId)}')`,{variant:'ghost',size:'sm',icon:'folder'})}
    <label class="ui-btn ui-btn-primary ui-btn-sm" style="cursor:pointer;margin:0">${ic('upload','w-4 h-4')}Upload file
      <input type="file" multiple style="display:none" onchange="App._docUpload('${esc(locId)}',this)"/>
    </label>
  </div>`:'';

  if(!folders.length&&!docs.length){
    return crumbs+toolbar+empty('folder','Nothing here yet',canUp?'Create a folder or upload the first file for this location.':'No documents have been added for this location.');
  }

  const folderGrid=folders.length?`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-bottom:14px">
    ${folders.map(f=>{
      const nDocs=(DB.tmDocuments||[]).filter(d=>d.folderId===f.id).length;
      const nSub=(DB.tmFolders||[]).filter(x=>x.parentId===f.id).length;
      return `<div onclick="App._docFolder('${esc(f.id)}')" class="fld-card" style="background:var(--c-surface);border-radius:var(--r-md);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:14px;cursor:pointer">
        <div style="margin-bottom:8px;color:var(--c-brand)">${ic('folder','w-7 h-7')}</div>
        <div style="font-size:13px;font-weight:700;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</div>
        <div style="font-size:11px;color:var(--c-text-3);margin-top:4px">${nDocs} file${nDocs===1?'':'s'}${nSub?' · '+nSub+' folder'+(nSub===1?'':'s'):''}</div>
        ${canDel?`<button type="button" onclick="event.stopPropagation();App._docDelFolder('${esc(f.id)}')" style="margin-top:8px;font-size:11px;font-weight:700;color:var(--c-danger-ink);background:none;border:none;cursor:pointer;padding:0">Delete</button>`:''}
      </div>`;}).join('')}
  </div>`:'';

  const docList=docs.length?`<div style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);overflow:hidden">
    ${docs.map((d,i)=>{
      const ext=(String(d.name).split('.').pop()||'').toLowerCase();
      const up=uById(d.uploadedBy);
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;${i<docs.length-1?'border-bottom:1px solid var(--c-border)':''}">
        <span style="display:grid;place-items:center;color:var(--c-text-3);flex-shrink:0">${_fileIcon(ext,'w-[22px] h-[22px]')}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(d.name)}</div>
          <div style="font-size:11px;color:var(--c-text-3);margin-top:1px">${_fmtBytes(d.fileSize)} · ${esc(up?fullName(up):(d.uploaderName||'Unknown'))}${d.uploadedAt?' · '+fmtS(String(d.uploadedAt).slice(0,10)):''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          ${btn('Download',`App._docDownload('${esc(d.id)}')`,{variant:'brand',size:'sm'})}
          ${canDel?`<button type="button" onclick="App._docDelete('${esc(d.id)}')" aria-label="Delete file" title="Delete file" style="display:grid;place-items:center;padding:6px 9px;border-radius:8px;background:var(--c-danger-soft);color:var(--c-danger-ink);border:1px solid transparent;cursor:pointer">${ic('trash','w-3.5 h-3.5')}</button>`:''}
        </div>
      </div>`;}).join('')}
  </div>`:'';

  return crumbs+toolbar+folderGrid+docList;
}

/* ── navigation ── */
App._docFolder=(id)=>{S.filters.docFolder=id||null;rr();};

/* ── create a folder ── */
App._docNewFolder=(locId)=>{
  if(!(can('locations','create')||can('locations','edit')||isAdmin()))return toast('You need Locations → Create or Edit','err');
  modalShell({title:'New folder',size:'max-w-sm',
    body:`<input id="doc-fname" class="ui-input rf" placeholder="Folder name" maxlength="80"/>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Create',`App._docNewFolderGo('${esc(locId)}')`)});
  setTimeout(()=>{const el=document.getElementById('doc-fname');if(el)el.focus();},60);
};
App._docNewFolderGo=(locId)=>{
  const name=($('#doc-fname')?.value||'').trim();
  if(!name)return toast('Give the folder a name','err');
  const f={id:uid('fld'),locationId:locId,parentId:S.filters.docFolder||null,name,createdBy:S.uid,createdAt:new Date().toISOString()};
  DB.tmFolders=DB.tmFolders||[];DB.tmFolders.push(f);
  _pushRow('tm_folders',_folderRow(f),'folder');
  log(fullName(me()),'Created folder',name+' · '+((locById(locId)||{}).name||''));
  saveDB();closeModal();toast('Folder created');rr();
};

/* ── upload ──
   Files go straight to the private bucket under <location>/<folder>/<id>_<name>; only the
   metadata lands in Postgres. A file that fails to upload never gets a row, so the list can
   never show something that isn't actually there. */
App._docUpload=async(locId,input)=>{
  const files=[...((input&&input.files)||[])];
  if(input)input.value='';
  if(!files.length)return;
  if(!(can('locations','create')||can('locations','edit')||isAdmin()))return toast('You need Locations → Create or Edit','err');
  const folderId=S.filters.docFolder||null;
  let ok=0,failed=0;
  toast('Uploading '+files.length+' file'+(files.length===1?'':'s')+'…');
  for(const file of files){
    if(file.size>DOC_MAX_BYTES){toast('"'+file.name+'" is over '+_fmtBytes(DOC_MAX_BYTES),'err');failed++;continue;}
    const id=uid('doc');
    const safe=String(file.name).replace(/[^\w.\- ]+/g,'_').slice(0,120);
    const path=locId+'/'+(folderId||'root')+'/'+id+'_'+safe;
    try{
      const {error}=await sb.storage.from('tm-location-docs').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||'application/octet-stream'});
      if(error){console.warn('[doc upload]',error.message);failed++;continue;}
      const d={id,locationId:locId,folderId,name:file.name,storagePath:path,fileType:file.type||'',fileSize:file.size,
        uploadedBy:S.uid,uploaderName:fullName(me()),uploadedAt:new Date().toISOString()};
      const {error:rowErr}=await sb.from('tm_documents').insert(_docRow(d));
      if(rowErr){
        // The row is what makes the file findable — if it fails, take the orphan back out.
        console.warn('[doc row]',rowErr.message);
        await sb.storage.from('tm-location-docs').remove([path]).catch(()=>{});
        failed++;continue;
      }
      DB.tmDocuments=DB.tmDocuments||[];DB.tmDocuments.unshift(d);ok++;
    }catch(e){console.warn('[doc upload]',e&&e.message);failed++;}
  }
  if(ok)log(fullName(me()),'Uploaded document'+(ok>1?'s':''),ok+' file(s) · '+((locById(locId)||{}).name||''));
  saveDB();rr();
  toast(failed?(ok+' uploaded, '+failed+' failed'):(ok+' file'+(ok===1?'':'s')+' uploaded'),failed?'warn':'ok');
};

/* ── download ── the bucket is private, so hand out a 5-minute signed URL ── */
App._docDownload=async(docId)=>{
  const d=(DB.tmDocuments||[]).find(x=>x.id===docId);if(!d)return;
  try{
    const {data,error}=await sb.storage.from('tm-location-docs').createSignedUrl(d.storagePath,300);
    if(error||!data||!data.signedUrl){toast('Could not open that file','err');return;}
    const a=document.createElement('a');a.href=data.signedUrl;a.download=d.name;a.target='_blank';a.rel='noopener';
    document.body.appendChild(a);a.click();a.remove();
  }catch(e){toast('Could not open that file','err');}
};

/* ── delete ── */
App._docDelete=(docId)=>{
  if(!(can('locations','delete')||isAdmin()))return toast('You need Locations → Delete','err');
  const d=(DB.tmDocuments||[]).find(x=>x.id===docId);if(!d)return;
  if(!confirm('Delete "'+d.name+'"? This cannot be undone.'))return;
  DB.tmDocuments=(DB.tmDocuments||[]).filter(x=>x.id!==docId);
  _delRow('tm_documents',docId,'document');
  sb.storage.from('tm-location-docs').remove([d.storagePath]).then(()=>{}).catch(()=>{});
  log(fullName(me()),'Deleted document',d.name);
  saveDB();toast('File deleted','warn');rr();
};
App._docDelFolder=(folderId)=>{
  if(!(can('locations','delete')||isAdmin()))return toast('You need Locations → Delete','err');
  const f=(DB.tmFolders||[]).find(x=>x.id===folderId);if(!f)return;
  const ids=_folderSubtree(f.locationId,folderId);
  const docs=(DB.tmDocuments||[]).filter(d=>ids.includes(d.folderId));
  if(!confirm('Delete "'+f.name+'"'+(docs.length?' and the '+docs.length+' file'+(docs.length===1?'':'s')+' inside it':'')+'? This cannot be undone.'))return;
  // Storage first — a failure there leaves the row, which is recoverable; the reverse is not.
  if(docs.length)sb.storage.from('tm-location-docs').remove(docs.map(d=>d.storagePath)).then(()=>{}).catch(()=>{});
  DB.tmDocuments=(DB.tmDocuments||[]).filter(d=>!ids.includes(d.folderId));
  DB.tmFolders=(DB.tmFolders||[]).filter(x=>!ids.includes(x.id));
  // The tm_folders self-reference cascades, so deleting the top folder takes the subtree
  // and every tm_documents row hanging off it with it.
  _delRow('tm_folders',folderId,'folder');
  if(S.filters.docFolder&&ids.includes(S.filters.docFolder))S.filters.docFolder=f.parentId||null;
  log(fullName(me()),'Deleted folder',f.name);
  saveDB();toast('Folder deleted','warn');rr();
};

/* — auto: expose on window (modules resolve cross-file references via window at call time) — */
window.DOC_MAX_BYTES=DOC_MAX_BYTES;window._mFolder=_mFolder;window._folderRow=_folderRow;window._mDoc=_mDoc;window._docRow=_docRow;
window._docsLoad=_docsLoad;window._fmtBytes=_fmtBytes;window._foldersIn=_foldersIn;window._docsIn=_docsIn;
window._folderTrail=_folderTrail;window._folderSubtree=_folderSubtree;window._locDocsTab=_locDocsTab;
