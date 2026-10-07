"""Prepare application icons from the project's existing, owned Lumo sprite."""
from PIL import Image
from pathlib import Path
import json, hashlib
root=Path(__file__).resolve().parent
assets=root/'web/assets'
source=assets/'lumo-poses.webp'
sprite=Image.open(source).convert('RGBA')
assert sprite.width==sprite.height and sprite.width%2==0
edge=sprite.width;half=edge//2
poses={'wave':(0,0,half,half),'joy':(half,0,edge,half),'think':(0,half,half,edge),'proud':(half,half,edge,edge)}
for pose,box in poses.items():
    cropped=sprite.crop(box)
    for size in (192,512):
        canvas=Image.new('RGBA',(size,size),'#f6f4ef')
        width=round(size*.78)
        resized=cropped.resize((width,width),Image.Resampling.LANCZOS)
        canvas.alpha_composite(resized,((size-width)//2,(size-width)//2))
        canvas.convert('RGB').save(assets/f'app-icon-lumo-{pose}-{size}.png')
        if pose=='wave': canvas.convert('RGB').save(assets/f'app-icon-lumo-{size}.png')
    cropped.resize((64,64),Image.Resampling.LANCZOS).save(assets/f'favicon-lumo-{pose}.png')
manifest=json.loads((root/'web/manifest.webmanifest').read_text(encoding='utf-8'))
manifest['background_color']='#f6f4ef'
manifest['theme_color']='#465c4c'
manifest['icons']=[{'src':f'assets/app-icon-lumo-{size}.png','sizes':f'{size}x{size}','type':'image/png','purpose':'any maskable'} for size in (192,512)]
manifest['shortcuts']=[{'name':'Моё занятие','short_name':'Занятие','url':'./?view=practice&mode=daily'}, {'name':'Сказать и сравнить','short_name':'Моя речь','url':'./?view=practice&mode=pronunciation'}, {'name':'Читать истории','short_name':'Истории','url':'./?view=practice&mode=reading'}, {'name':'Мой профиль','short_name':'Профиль','url':'./?view=profile'}]
(root/'web/manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for pose in poses:
    variant={**manifest,'icons':[{**icon,'src':icon['src'].replace('lumo-',f'lumo-{pose}-')} for icon in manifest['icons']]}
    (root/f'web/manifest-lumo-{pose}.webmanifest').write_text(json.dumps(variant,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
docs=root/'docs';docs.mkdir(exist_ok=True)
(root/'identity-assets-v13.json').write_text(json.dumps({'source':'web/assets/lumo-poses.webp','sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'provenance':'Derived from existing project-owned Lumo artwork. No third-party asset added. Refer to original lumo-poses.webp.json for source metadata.','operation':'Exact single-quadrant crops; Lanczos resize; chalk background for application icons.','spriteSize':list(sprite.size),'crops':poses,'applicationSizes':[192,512],'faviconSize':64},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
