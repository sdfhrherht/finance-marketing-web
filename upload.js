(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'upload-dialog';
  dialog.setAttribute('aria-labelledby', 'upload-title');
  dialog.innerHTML = `<div class="card-head"><h2 id="upload-title">导入关系数据</h2><button type="button" class="secondary" id="upload-close" aria-label="关闭文件预览">关闭</button></div>
    <p class="muted">选择 CSV 或 TXT 关系表，查看文件内容与字段。</p>
    <label class="upload-drop" for="upload-file"><strong>选择关系数据文件</strong><span>CSV / TXT · 最大 10 MB</span><input id="upload-file" type="file" accept=".csv,.txt,text/csv,text/plain"></label>
    <div class="upload-actions"><button type="button" class="secondary" id="upload-template">下载格式模板</button><span class="muted">SOURCE、TARGET、RATING；TIME 可选</span></div>
    <p id="upload-status" role="status" class="muted">请选择文件。</p>
    <div id="upload-preview"></div>
    <div class="hint" id="upload-current"></div>
    <div class="upload-actions"><button type="button" class="primary" id="upload-confirm" disabled>保存文件预览</button></div>`;
  document.body.append(dialog);
  const box=document.querySelector('.data-box');
  const open=document.createElement('button');
  open.type='button';open.className='secondary upload-open';open.textContent='↑ 上传关系数据';
  const info=document.createElement('button');
  info.type='button';info.className='upload-file-info';info.hidden=true;
  box.append(open,info);
  const fileInput=dialog.querySelector('#upload-file'),status=dialog.querySelector('#upload-status'),preview=dialog.querySelector('#upload-preview'),confirm=dialog.querySelector('#upload-confirm');
  let selected=null, generation=0;
  function show(){dialog.querySelector('#upload-current').textContent='当前分析数据：'+document.querySelector('#dataset').selectedOptions[0].textContent+'。文件预览与当前分析结果分别保留。';dialog.showModal()}
  open.onclick=show;info.onclick=show;
  dialog.querySelector('#upload-close').onclick=()=>dialog.close();
  dialog.querySelector('#upload-template').onclick=()=>download('关系数据模板.csv','SOURCE,TARGET,RATING,TIME\r\n1,2,5,1700000000\r\n2,3,-2,1700000010\r\n3,1,8,1700000020\r\n','text/csv;charset=utf-8');
  function splitCSV(line){const cells=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){cells.push(value.trim());value=''}else value+=c}if(quoted)throw Error('CSV 引号未闭合。');cells.push(value.trim());return cells}
  function parse(text){
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map((s,i)=>({s:s.trim(),line:i+1})).filter(r=>r.s&&!r.s.startsWith('#'));
    if(!lines.length)throw Error('文件为空，或只包含注释。');
    const comma=lines[0].s.includes(','),split=s=>comma?splitCSV(s):s.split(/\s+/);
    const first=split(lines[0].s),header=first.map(s=>s.toUpperCase());
    const hasHeader=['SOURCE','TARGET','RATING'].every(s=>header.includes(s));
    if(!hasHeader&&first.slice(0,3).some(s=>!s||!Number.isFinite(Number(s))))throw Error('表头需包含 SOURCE、TARGET、RATING；无表头时前三列应为数值。');
    const keys=['SOURCE','TARGET','RATING','TIME'],indexes=hasHeader?keys.map(k=>header.indexOf(k)):[0,1,2,3];
    const nodes=new Set(),sample=[];let records=0,positive=0,negative=0;
    for(const row of lines.slice(hasHeader?1:0)){
      const cells=split(row.s);
      const values=indexes.map((index,i)=>index<0||index>=cells.length?(i===3?0:NaN):(cells[index]===''?NaN:Number(cells[index])));
      if(values.some(v=>!Number.isFinite(v))||!Number.isSafeInteger(values[0])||!Number.isSafeInteger(values[1]))throw Error(`第 ${row.line} 行格式无效：用户 ID 应为整数，评分与时间应为数值。`);
      nodes.add(values[0]);nodes.add(values[1]);records++;if(values[2]>0)positive++;if(values[2]<0)negative++;
      if(sample.length<8)sample.push(values);
    }
    if(!records)throw Error('文件只有表头，没有关系记录。');
    return {records,nodes:nodes.size,positive,negative,sample};
  }
  fileInput.onchange=async()=>{
    const current=++generation;selected=null;confirm.disabled=true;info.hidden=true;preview.replaceChildren();status.className='muted';
    const file=fileInput.files[0];if(!file){status.textContent='请选择文件。';return}
    try{
      if(!/\.(csv|txt)$/i.test(file.name))throw Error('请选择 CSV 或 TXT 文件。');
      if(file.size>10*1024*1024)throw Error('文件超过 10 MB，请选择较小的关系表。');
      status.textContent='正在读取文件…';
      const text=await file.text();if(current!==generation)return;
      const result=parse(text);selected={name:file.name,size:file.size,...result};
      status.textContent=`已读取 ${file.name} · ${result.records.toLocaleString()} 条记录 · ${result.nodes.toLocaleString()} 位用户`;
      const wrap=document.createElement('div');wrap.className='table-wrap';const table=document.createElement('table'),head=document.createElement('thead'),hr=document.createElement('tr');
      ['SOURCE','TARGET','RATING','TIME'].forEach(key=>{const th=document.createElement('th');th.textContent=key;hr.append(th)});head.append(hr);table.append(head);
      const body=document.createElement('tbody');result.sample.forEach(row=>{const tr=document.createElement('tr');row.forEach(v=>{const td=document.createElement('td');td.textContent=String(v);tr.append(td)});body.append(tr)});table.append(body);wrap.append(table);preview.append(wrap);
      const note=document.createElement('p');note.className='muted';note.textContent=`前 ${result.sample.length} 条记录预览 · 正评分 ${result.positive.toLocaleString()} 条，负评分 ${result.negative.toLocaleString()} 条`;preview.append(note);confirm.disabled=false;
    }catch(e){if(current!==generation)return;status.className='error';status.textContent=e.message}
  };
  confirm.onclick=()=>{if(!selected)return;info.hidden=false;info.textContent='已读取文件：'+selected.name;info.title='查看文件预览';dialog.close()};
})();
