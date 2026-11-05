"""Normalize authorized collector output; do not manufacture missing records."""
import argparse, csv, json, shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--raw-dir',type=Path,default=Path('estimation/collection'));p.add_argument('--data-dir',type=Path,default=Path('estimation/data'));a=p.parse_args()
read=lambda name:json.loads((a.raw_dir/name).read_text(encoding='utf-8-sig'))
regular=read('regular-2010-2026.json');postseason=read('postseason-audited.json')
assert len(regular)==11388 and len(postseason)==231, 'Review coverage before updating fixed snapshot'
a.data_dir.mkdir(parents=True,exist_ok=True)
with (a.data_dir/'regular.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=['id','date','season','away','home','awayScore','homeScore','venue']);w.writeheader();w.writerows({k:r[k] for k in w.fieldnames} for r in regular)
(a.data_dir/'postseason.json').write_text(json.dumps(postseason,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for name in ['regular-manifest.json','postseason-manifest.json']:
    if (a.raw_dir/name).exists():shutil.copyfile(a.raw_dir/name,a.data_dir/name)
print('Normalized 11,388 regular games and 231 postseason games.')
