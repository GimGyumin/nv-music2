import fs from 'fs';
const files = [
  'src/components/AlbumDetail.tsx',
  'src/components/AlbumList.tsx',
  'src/components/Login.tsx',
  'src/components/PlayerBar.tsx',
  'src/components/Sidebar.tsx'
];
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf-8');
  content = content.replace(/pink-/g, 'red-');
  fs.writeFileSync(f, content);
});
console.log('Done');
