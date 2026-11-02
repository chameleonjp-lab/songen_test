import {mkdir,copyFile,readdir} from 'node:fs/promises';
await mkdir('_site/js',{recursive:true});await copyFile('index.html','_site/index.html');
for(const file of await readdir('js'))if(file.endsWith('.js'))await copyFile('js/'+file,'_site/js/'+file);
await mkdir('_site/assets',{recursive:true});await copyFile('assets/social-card.png','_site/assets/social-card.png');
