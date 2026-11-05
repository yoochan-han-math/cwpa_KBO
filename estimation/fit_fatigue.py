"""Calendar workload experiment. Inclusion requested; coefficients are fitted, not imposed."""
import argparse, datetime as dt, hashlib, json, math
from pathlib import Path
import numpy as np
from fit_historical import DAY, read_json, read_csv, canonical, prepare, regular_features, fit, predict, metrics

FAMILIES=['rest3','rest7','restLog','load3','load7','games7']
PENALTIES=[.001,.01,.1,1.]

def workload(history,day,tau):
    return sum(math.exp(-(day-d-1)/tau) for d in history if d<day)

def fatigue_features(home,away,date,history):
    day=DAY(date)
    rest={t:day-max(d for d in history[t] if d<day)-1 for t in [home,away]}
    return {'rest3':min(rest[home],3)-min(rest[away],3),
        'rest7':min(rest[home],7)-min(rest[away],7),
        'restLog':math.log1p(rest[home])-math.log1p(rest[away]),
        **{'load'+str(tau):workload(history[away],day,tau)-workload(history[home],day,tau) for tau in [3,7]},
        'games7':sum(day-7<=d<day for d in history[away])-sum(day-7<=d<day for d in history[home])}

def prepare_fatigue(data_dir):
    regular=read_csv(data_dir/'regular.csv');postseason=read_json(data_dir/'postseason.json')
    ps,initial,summary,exclusions=prepare(data_dir);reg=regular_features(data_dir)
    maps={r['id']:r for r in reg+ps}
    for year in range(2010,2027):
        history={};rg=sorted([g for g in regular if int(g['season'])==year],key=lambda g:g['date'])
        if year==2026:rg=[g for g in rg if g['date']<'2026-10-14']
        for date in sorted({g['date'] for g in rg}):
            today=[g for g in rg if g['date']==date]
            for g in today:
                h,a=canonical(g['home']),canonical(g['away'])
                if g['id'] in maps:maps[g['id']]['features'].update(fatigue_features(h,a,date,history))
            # Same-date regular doubleheaders never use the other game's outcome/activity.
            for g in today:
                for t in [canonical(g['home']),canonical(g['away'])]:history.setdefault(t,[]).append(DAY(date))
        for y,date,ts in [(2021,'2021-10-31',['KT','삼성']),(2024,'2024-10-01',['KT','SSG'])]:
            if y==year:
                for t in ts:history[t].append(DAY(date))
        if year==2026:
            for t in initial:initial[t]['activityDates']=[dt.date.fromordinal(d).isoformat() for d in history[t]]
            continue
        for g in sorted([g for g in postseason if g['season']==year],key=lambda g:(g['date'],g['number'])):
            h,a=canonical(g['home']),canonical(g['away'])
            if g['id'] in maps:
                maps[g['id']]['features'].update(fatigue_features(h,a,g['date'],history))
                maps[g['id']]['loads7']={t:workload(history[t],DAY(g['date']),7) for t in [h,a]}
            for t in [h,a]:history[t].append(DAY(g.get('completionDate') or g['date']))
    return ps,reg,initial,summary,exclusions

def run(data_dir,output,bootstrap=500):
    ps,reg,initial,summary,exclusions=prepare_fatigue(data_dir)
    candidates=[];priors={}
    for feature in FAMILIES:
        names=['strength','home',feature]
        priors[feature]={year:fit([r for r in reg if r['season']<=year],names,0) for year in range(2013,2026)}
        for prior_type in ['zero','regular-season']:
            for penalty in PENALTIES:
                val_all=[];pred_all=[];folds=[]
                for year in range(2014,2023):
                    train=[r for r in ps if r['season']<year];val=[r for r in ps if r['season']==year]
                    b=fit(train,names,penalty,priors[feature][year-1] if prior_type=='regular-season' else None)
                    p=predict(val,b);val_all.extend(val);pred_all.extend(p)
                    folds.append({'year':year,'trainThrough':year-1,**metrics(val,p)})
                candidates.append({'features':names,'lambda':penalty,'priorType':prior_type,'validation':metrics(val_all,pred_all),'folds':folds})
    candidates.sort(key=lambda c:c['validation']['logLoss'])
    selected=candidates[0];names=selected['features'];feature=names[-1];penalty=selected['lambda'];empirical=selected['priorType']=='regular-season'
    # A different selected definition requires an explicitly implemented path-state adapter.
    if feature!='load7':raise ValueError('Selected feature changed; review production calendar adapter before publication')
    frozen=fit([r for r in ps if r['season']<=2022],names,penalty,priors[feature][2022] if empirical else None)
    held=[r for r in ps if r['season']>=2023];hp=predict(held,frozen)
    final=fit(ps,names,penalty,priors[feature][2025] if empirical else None)
    baseline=np.array([.5 if r['neutral'] else .533 for r in held])
    family_comparison=[]
    for f in FAMILIES:
        c=next(c for c in candidates if c['features'][-1]==f)
        family_comparison.append({**c,'deploymentCoefficients':fit(ps,c['features'],c['lambda'],priors[f][2025] if c['priorType']=='regular-season' else None)})
    rng=np.random.default_rng(20261105);seasons=sorted({r['season'] for r in ps});samples=[]
    for _ in range(bootstrap):
        years=rng.choice(seasons,len(seasons),replace=True)
        rows=[r for y in years for r in ps if r['season']==y]
        prior=fit([r for y in years for r in reg if r['season']==y],names,0) if empirical else None
        samples.append(fit(rows,names,penalty,prior))
    intervals={f:[float(v) for v in np.quantile([s[f] for s in samples],[.025,.975])] for f in names}
    v1=read_json(Path(__file__).resolve().parent.parent/'strength-home-fit.json')
    report={'id':'kbo-adjusted-v2-calendar-fatigue','available':True,'status':'estimated-experimental','checkedAt':'2026-11-05',
        'trainingPeriod':'2010–2025','sampleSize':len(ps),'features':names,'coefficients':final,'lambda':penalty,'priorType':selected['priorType'],
        'fatigue':{'feature':feature,'tauDays':7,'halfLifeDays':7*math.log(2),'definition':'L_t(d)=sum(exp(-(d-gameDate-1)/7)); x=awayLoad-homeLoad',
            'inclusionPolicy':'Calendar fatigue required by product request; select among fatigue-inclusive candidates, not a claim of better forecast accuracy',
            'assumptions':['Each game contributes one workload unit regardless of innings or pitch count','Decay scale selected from candidate definitions, not measured biological recovery','All past activity through previous calendar date; no future observed games','Future games use planned dates plus delays observed so far and minimum travel gap','A new observed date may update championship probability separately from player cWPA']},
        'regularPrior':{'eligibleGames':len(reg),'coefficients':priors[feature][2025],'minimumPriorDecisions':30,'fit':'unpenalized logistic, same fatigue feature; previous-calendar-date features'},
        'selection':{'metric':'logLoss','validationSeasons':'2014–2022 expanding window','candidates':candidates},'familyComparison':family_comparison,
        'holdout':{'period':'2023–2025','trainedThrough':2022,'coefficients':frozen,'adjusted':metrics(held,hp),'baseline':metrics(held,baseline),
            'yearly':[{'season':y,'adjusted':metrics([r for r in held if r['season']==y],hp[[r['season']==y for r in held]])} for y in [2023,2024,2025]]},
        'comparisonWithoutFatigue':{'id':v1['id'],'coefficients':v1['coefficients'],'validation':v1['selection']['candidates'][0]['validation'],'holdout':v1['holdout']['adjusted'],
            'validationLogLossDifference':selected['validation']['logLoss']-v1['selection']['candidates'][0]['validation']['logLoss']},
        'diagnostics':{'strengthFatigueCorrelation':float(np.corrcoef([r['features']['strength'] for r in ps],[r['features'][feature] for r in ps])[0,1]),
            'nonzeroFatigueGames':sum(abs(r['features'][feature])>1e-10 for r in ps),'nonzeroRestGames':sum(abs(r['features']['restLog'])>1e-10 for r in ps)},
        'coefficientIntervals':{'method':'season-cluster percentile bootstrap; selected specification fixed','replicates':bootstrap,'seed':20261105,'intervals95':intervals},
        'initialTeams':initial,'seasonSummary':summary,'exclusions':exclusions,
        'inputHashes':{f:hashlib.sha256((data_dir/f).read_bytes()).hexdigest() for f in ['regular.csv','postseason.json']},'sources':v1['sources'],
        'limitations':['Fatigue inclusion is a requested modelling choice; validation error is slightly worse than v1 without fatigue','Calendar workload is a proxy, not physiological measurement or a causal fatigue estimate','Seed, strength and workload are confounded; coefficient interval may include zero','Retrospective exploratory evaluation; 2023–2025 outcomes already viewed during earlier development','No individual starters, bullpen pitches, injury or extra-inning weights','Future schedule is a declared scenario, updated only when each actual game begins','Constant log-odds state WP correction remains an approximation']}
    output.mkdir(parents=True,exist_ok=True)
    (output/'model-fit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    production={k:report[k] for k in ['id','status','available','checkedAt','trainingPeriod','sampleSize','features','coefficients','lambda','priorType','regularPrior','fatigue','initialTeams','holdout','coefficientIntervals','limitations','sources']}
    (output/'fitted-model.mjs').write_text('export const fittedModel = '+json.dumps(production,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    (output/'fatigue-training-features.json').write_text(json.dumps(ps,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:report[k] for k in ['coefficients','coefficientIntervals','holdout','comparisonWithoutFatigue','diagnostics']},ensure_ascii=False,indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--data-dir',type=Path,default=Path('estimation/data'));p.add_argument('--output',type=Path,default=Path('.'));p.add_argument('--bootstrap',type=int,default=500)
    a=p.parse_args();run(a.data_dir,a.output,a.bootstrap)
