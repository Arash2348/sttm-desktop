# open-pr.py <stage dir> — open the GAB dataset PR from a staged folder (VM: its token can open PRs; the Mac token
# cannot). pr.json in the stage holds title/description and is not uploaded. Refuses if main's manifest moved: every
# main row must still be in the staged manifest except the rows the stage says it changes (pr.json "changes_rows").
import json, os, sys, urllib.request
from huggingface_hub import HfApi
st = sys.argv[1]; REPO = 'khalisfoundation/GurbaniAutopilotBench'
pr = json.load(open(os.path.join(st, 'pr.json')))
req = urllib.request.Request(f'https://huggingface.co/datasets/{REPO}/resolve/main/manifest.csv', headers={'Authorization': 'Bearer ' + os.environ['HF_TOKEN']})
main = urllib.request.urlopen(req).read().decode().split('\n')
staged = set(open(os.path.join(st, 'manifest.csv')).read().split('\n'))
missing = [l for l in main if l.strip() and l not in staged]
if len(missing) != pr.get('changes_rows', 0):
    print(f'PR NOT OPENED: main manifest moved ({len(missing)} main rows not in the stage, expected {pr.get("changes_rows", 0)})'); sys.exit(3)
api = HfApi(token=os.environ['HF_TOKEN'])
info = api.upload_folder(folder_path=st, repo_id=REPO, repo_type='dataset', create_pr=True, ignore_patterns=['pr.json'], commit_message=pr['title'], commit_description=pr['description'])
print('PR opened:', info.pr_url)
