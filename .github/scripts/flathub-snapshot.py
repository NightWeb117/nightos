"""Saves a list of popular Flathub apps to site/store/flathub.json.

The NightOS website can't call Flathub's search API from the browser, so App Center's
Flatpak tab browses this copy. The deploy workflow refreshes it on every deploy.
NightOS for Windows searches Flathub live instead.
"""
import json, re, sys, time, urllib.request

API = 'https://flathub.org/api/v2/collection/'
VALID = re.compile(r'^[A-Za-z][\w-]*(\.[\w-]+){2,}$')

def get(path):
    req = urllib.request.Request(API + path, headers={'User-Agent': 'NightOS-snapshot'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r).get('hits', [])

def slim(h):
    return {'id': h['app_id'], 'name': h.get('name') or h['app_id'], 'summary': h.get('summary') or '',
            'icon': h.get('icon') or '', 'category': h.get('main_categories') or '',
            'developer': h.get('developer_name') or '', 'installs': h.get('installs_last_month') or 0,
            'verified': str(h.get('verification_verified')).lower() == 'true'}

apps = [slim(h) for p in (1, 2) for h in get(f'popular?page={p}&per_page=250') if VALID.match(h.get('app_id') or '')]
hot = [h for h in get('trending?page=1&per_page=60') if VALID.match(h.get('app_id') or '')]
trending = [h['app_id'] for h in hot]
known = {a['id'] for a in apps}
apps += [slim(h) for h in hot if h['app_id'] not in known]
out = sys.argv[1] if len(sys.argv) > 1 else 'site/store/flathub.json'
with open(out, 'w', encoding='utf-8') as f:
    json.dump({'updated': int(time.time()), 'trending': trending, 'apps': apps}, f, ensure_ascii=False, separators=(',', ':'))
print(f'{len(apps)} apps written to {out}')
