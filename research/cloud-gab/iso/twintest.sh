REPO=/home/user/sttm-desktop; W=/root/personal/vmscore; T=/home/user/gab-tools/research/level2-dataset/tools; R=/home/user/gab-tools/research/level2-dataset/results/gab
node $REPO/research/cloud-gab/results-sync.js pull | tail -1
git -C $W checkout -q -f --detach 02afebe
for kv in KIRTAN_FOLLOW=1 NEAR_TWIN=0.03; do sed -i "s/^const ${kv%%=*} = [^;]*;/const ${kv%%=*} = ${kv#*=};/" $W/www/main/addons/voice-follow/components/VoiceFollow.jsx; done
git -C $W -c user.name=cloud-gab -c user.email=cloud-gab@localhost commit -qam "Experiment: KIRTAN_FOLLOW=1 NEAR_TWIN=0.03" --date "2026-01-01T00:00:00Z"
for t in main akhand hard; do (cd $T && VF_MIN_FREE_GB=1 VF_NO_EMIS_PULL=1 ./gab run $W --set $t --tier full --jobs 4 --manifest hf --split test > /home/user/gab/logs/twin3-test-$t.log 2>&1); echo "$t exit $? card $(ls -t $R | head -1)"; grep -E "^\| \*\*(Kirtan|Bani|Akhand)|INCOMPLETE" /home/user/gab/logs/twin3-test-$t.log | grep -v 'no clip\|no GAB\|replay runner\|no Akhand Paath clip' | cut -c1-210; done
