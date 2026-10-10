"""Generate the local visual fixture from current production Breed Studio, without editing it."""
from pathlib import Path
import hashlib
import json
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
source=(ROOT/'breeds.html').read_text()
sha=hashlib.sha256(source.encode()).hexdigest()
style='''<base href="/"><style>
main{grid-template-columns:310px minmax(0,1fr)}aside{padding:16px}aside>a,aside>.eyebrow,aside>h1,aside>p,.search-label,#breed-search,#list,.count{display:none!important}.controls{height:1px;max-height:1px;min-height:0;padding:0;opacity:0;pointer-events:none;overflow:hidden;bottom:8px}.caption{top:14px;left:24px}.caption #traits{max-width:540px}#draftReview h1{font-size:28px;margin:0 0 8px}#draftReview p{font-size:12px;margin:7px 0}#draftReview label{display:grid;gap:3px;font-size:12px;margin:9px 0}#draftReview select{width:100%;min-height:42px;padding:7px}#draftReview input{width:100%}.qa-phases{display:flex;gap:4px;flex-wrap:wrap}#draftReview button{font-size:12px;min-height:40px;padding:7px 9px}#qaCapture{width:100%;margin-top:9px}#qaReport{max-height:230px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:10px/1.3 monospace;background:#0c1e19;padding:8px}#qaStatus{color:#ead79c}@media(max-width:700px){main{grid-template-columns:250px minmax(0,1fr);grid-template-rows:1fr}aside{padding:10px}}
</style>'''
source=source.replace('<head>','<head>'+style,1)
source=source.replace("catalog.then(m=>{if(ticket===0)select(m?.breeds[initial]?initial:'white-western');});",'// Fixture owns the initial selected draft.')
source=source.replace("const $=id=>document.getElementById(id),stage=$('stage');", "if(location.protocol!=='http:'||!['127.0.0.1','localhost'].includes(location.hostname)||location.port!=='18799')throw Error('Use dedicated localhost port 18799 for this fixture.');\nconst $=id=>document.getElementById(id),stage=$('stage');",1)
# Append into the existing module's lexical scope; all model/motion functions stay production code.
marker='</script></body></html>'
assert source.count(marker)==1
source=source.replace(marker,'\nconst QA_STUDIO_SOURCE_SHA='+json.dumps(sha)+';\n'+(HERE/'controls.js').read_text()+'\n'+marker)
(HERE/'index.html').write_text(source)
(HERE/'source.json').write_text(json.dumps({'source':'breeds.html','sha256':sha,'fixture':'review/draft-front-check/index.html','changes':'Localhost guard, base URL, fixture controls/styles, initial-selection ownership. No production loader/motion/geometry modification.'},indent=2)+'\n')
print('Generated draft front fixture from',sha)
