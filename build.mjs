import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});for(const f of ['index.html','app.mjs','model.mjs','style.css','data.json'])await copyFile(f,'dist/'+f);

