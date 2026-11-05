"""Reproducible, offline KBO postseason ridge-logit estimation. No 2026 outcomes in fitting."""
import argparse, csv, datetime as dt, hashlib, json, math
from pathlib import Path
import numpy as np

DAY = lambda x: dt.date.fromisoformat(x).toordinal()
def read_json(path): return json.loads(Path(path).read_text(encoding='utf-8-sig'))
def read_csv(path):
    with Path(path).open(encoding='utf-8',newline='') as handle:return list(csv.DictReader(handle))
def canonical(team): return {'넥센':'키움','히어로즈':'키움','SK':'SSG'}.get(team,team)
def sigmoid(z): return 1/(1+np.exp(-np.clip(z,-700,700)))
def features_for(home, away, date, strength, history, home_field):
    day=DAY(date)
    last={t:max(d for d in history[t] if d<day) for t in [home,away]}
    rest={t:day-last[t]-1 for t in [home,away]}
    recent={t:sum(day-7<=d<day for d in history[t]) for t in [home,away]}
    return {'strength':strength[home]-strength[away], 'home':home_field,
            'rest':math.log1p(rest[home])-math.log1p(rest[away]),
            'games7':recent[home]-recent[away]},rest,recent

def prepare(data_dir):
    regular=read_csv(data_dir/'regular.csv')
    postseason=read_json(data_dir/'postseason.json')
    assert len({g['id'] for g in regular})==len(regular)
    assert len({g['id'] for g in postseason})==len(postseason)
    records=[]; initial_2026=None; summaries=[]; exclusions=[]
    for year in range(2010,2027):
        ps=sorted([g for g in postseason if g['season']==year],key=lambda g:(g['date'],g['number']))
        cutoff=ps[0]['date'] if ps else '2026-10-14'
        rs=[g for g in regular if int(g['season'])==year and g['date']<cutoff]
        stats={}; history={}
        for g in rs:
            hs,aws=int(g['homeScore']),int(g['awayScore'])
            for team,score,opp in [(canonical(g['home']),hs,aws),(canonical(g['away']),aws,hs)]:
                s=stats.setdefault(team,dict(w=0,l=0,d=0,runs=0,allowed=0))
                s['w']+=score>opp;s['l']+=score<opp;s['d']+=score==opp;s['runs']+=score;s['allowed']+=opp
                history.setdefault(team,[]).append(DAY(g['date']))
        assert all(s['w']>0 and s['l']>0 for s in stats.values())
        strength={t:math.log(s['w']/s['l']) for t,s in stats.items()}
        # 2021 first-place tiebreak counts as physical activity, not regular strength.
        if year==2021:
            for t in ['KT','삼성']: history[t].append(DAY('2021-10-31'))
        if year==2024:
            for t in ['KT','SSG']: history[t].append(DAY('2024-10-01'))
        summaries.append({'season':year,'regularGamesBeforePS':len(rs),'cutoff':cutoff,'teams':stats})
        if year==2026:
            participants=['KT','삼성','KIA','LG','두산']
            initial_2026={t:{**stats[t],'strength':strength[t],
                'lastDate':dt.date.fromordinal(max(history[t])).isoformat(),
                'recentDates':[dt.date.fromordinal(d).isoformat() for d in history[t] if d>=DAY(cutoff)-7]} for t in participants}
            continue
        for g in ps:
            h,a=canonical(g['home']),canonical(g['away'])
            # Explicit neutral-site policies; shared Jamsil home designation is retained.
            neutral=(year==2020 and g['stage'] in ['PO','KS']) or (year==2021 and g['stage']=='KS') or (year<=2015 and g['stage']=='KS' and g['venue']=='잠실' and h not in ['LG','두산'] and a not in ['LG','두산'])
            x,rest,recent=features_for(h,a,g['date'],strength,history,0 if neutral else 1)
            row={**g,'home':h,'away':a,'features':x,'restDays':rest,'gamesLast7':recent,
                 'homeWin':int(g['homeScore']>g['awayScore']),'neutral':neutral,
                 'strengthCutoff':cutoff,'strengthLatestDate':max(r['date'] for r in rs)}
            if g.get('restFitExclude') or g['homeScore']==g['awayScore']:
                exclusions.append({'id':g['id'],'reason':'suspended/same-day resumption rest ambiguity' if g.get('restFitExclude') else 'draw'})
            else: records.append(row)
            activity=DAY(g.get('completionDate') or g['date'])
            for t in [h,a]: history[t].append(activity)
    return records,initial_2026,summaries,exclusions

def regular_features(data_dir):
    games=read_csv(data_dir/'regular.csv')
    records=[]
    for season in range(2010,2026):
        season_games=sorted([g for g in games if int(g['season'])==season],key=lambda g:(g['date'],g['id']))
        stats={}
        for date in sorted({g['date'] for g in season_games}):
            today=[g for g in season_games if g['date']==date]
            for g in today:
                h,a=canonical(g['home']),canonical(g['away']);hs,aws=int(g['homeScore']),int(g['awayScore'])
                sh,sa=stats.get(h,{'w':0,'l':0}),stats.get(a,{'w':0,'l':0})
                if all(s['w']+s['l']>=30 and min(s['w'],s['l'])>0 for s in [sh,sa]) and hs!=aws:
                    records.append({'id':g['id'],'season':season,'date':date,'homeWin':int(hs>aws),
                        'features':{'strength':math.log(sh['w']/sh['l'])-math.log(sa['w']/sa['l']),'home':1}})
            # Both doubleheader predictions use information through the previous date.
            for g in today:
                hs,aws=int(g['homeScore']),int(g['awayScore'])
                for t,score,opp in [(canonical(g['home']),hs,aws),(canonical(g['away']),aws,hs)]:
                    s=stats.setdefault(t,{'w':0,'l':0});s['w']+=score>opp;s['l']+=score<opp
    return records

def fit(rows,names,penalty,prior=None):
    x=np.array([[r['features'][f] for f in names] for r in rows],float);y=np.array([r['homeWin'] for r in rows],float)
    scale=np.sqrt(np.mean(x*x,axis=0));scale[scale==0]=1;x=x/scale
    center=np.array([(prior or {}).get(f,0) for f in names])*scale
    b=center.copy()
    def loss(beta):
        z=x@beta;return np.mean(np.logaddexp(0,z)-y*z)+penalty*np.sum((beta-center)**2)/2
    for iteration in range(100):
        p=sigmoid(x@b); grad=x.T@(p-y)/len(y)+penalty*(b-center)
        hess=(x.T*(p*(1-p)))@x/len(y)+penalty*np.eye(len(names))
        delta=np.linalg.solve(hess,grad)
        if np.max(np.abs(grad))<1e-8: break
        rate=1;old=loss(b)
        while loss(b-rate*delta)>old and rate>1e-8:rate/=2
        b-=rate*delta
    else: raise ValueError('No convergence')
    return {f:float(v) for f,v in zip(names,b/scale)}
def predict(rows,b):return sigmoid(np.array([sum(r['features'][f]*v for f,v in b.items()) for r in rows]))
def metrics(rows,p):
    y=np.array([r['homeWin'] for r in rows]);p=np.array(p)
    return {'n':len(rows),'logLoss':float(np.mean(-y*np.log(p)-(1-y)*np.log(1-p))), 'brier':float(np.mean((p-y)**2)),
            'accuracy':float(np.mean((p>=.5)==y)),'meanPrediction':float(np.mean(p)),'observedHomeWin':float(np.mean(y))}

def run(data_dir,output,bootstrap=500):
    rows,initial,season_summary,exclusions=prepare(data_dir)
    regular=regular_features(data_dir)
    priors={year:fit([r for r in regular if r['season']<=year],['strength','home'],0) for year in range(2013,2026)}
    assert all(r['season']<2026 and r['strengthLatestDate']<r['date'] for r in rows)
    # Predeclared candidate families; every candidate retains strength and home effects.
    families=[['strength','home'],['strength','home','rest'],['strength','home','rest','games7']]
    penalties=[.0001,.001,.01,.1,1.]
    candidates=[]
    for prior_type in ['zero','regular-season']:
        for names in families:
            for penalty in penalties:
                validation=[];predictions=[];folds=[]
                for year in range(2014,2023):
                    train=[r for r in rows if r['season']<year]; val=[r for r in rows if r['season']==year]
                    b=fit(train,names,penalty,priors[year-1] if prior_type=='regular-season' else None);p=predict(val,b)
                    validation.extend(val);predictions.extend(p)
                    folds.append({'year':year,'trainThrough':year-1,**metrics(val,p)})
                candidates.append({'features':names,'lambda':penalty,'priorType':prior_type,'validation':metrics(validation,predictions),'folds':folds})
    candidates.sort(key=lambda c:c['validation']['logLoss'])
    selected=candidates[0];names=selected['features'];penalty=selected['lambda']
    training=[r for r in rows if r['season']<=2022];held=[r for r in rows if 2023<=r['season']<=2025]
    empirical=selected['priorType']=='regular-season'
    frozen=fit(training,names,penalty,priors[2022] if empirical else None);hp=predict(held,frozen)
    baseline=np.array([.5 if r['neutral'] else .533 for r in held])
    yearly=[{'season':year,'adjusted':metrics([r for r in held if r['season']==year],hp[[r['season']==year for r in held]]),
             'baseline':metrics([r for r in held if r['season']==year],baseline[[r['season']==year for r in held]])} for year in range(2023,2026)]
    final=fit(rows,names,penalty,priors[2025] if empirical else None)
    family_comparison=[]
    for feature_names in families:
        best=next(c for c in candidates if c['features']==feature_names)
        family_comparison.append({**best,'deploymentCoefficients':fit(rows,feature_names,best['lambda'],priors[2025] if best['priorType']=='regular-season' else None)})
    rng=np.random.default_rng(20261105);seasons=sorted({r['season'] for r in rows});samples=[]
    for _ in range(bootstrap):
        sampled_years=rng.choice(seasons,len(seasons),replace=True)
        sampled=[r for year in sampled_years for r in rows if r['season']==year]
        reg_sampled=[r for year in sampled_years for r in regular if r['season']==year]
        empirical_prior=fit(reg_sampled,['strength','home'],0) if empirical else None
        samples.append(fit(sampled,names,penalty,empirical_prior))
    intervals={f:[float(v) for v in np.quantile([s[f] for s in samples],[.025,.975])] for f in names}
    calibration=[]
    for lo,hi in zip([0,.2,.4,.6,.8],[.2,.4,.6,.8,1.000001]):
        ix=(hp>=lo)&(hp<hi)
        if np.any(ix):calibration.append({'low':lo,'high':min(1,hi),'n':int(np.sum(ix)),**metrics([r for r,i in zip(held,ix) if i],hp[ix])})
    report={'id':'kbo-adjusted-v1','status':'estimated-experimental','available':True,'checkedAt':'2026-11-05',
      'trainingPeriod':'2010–2025','sampleSize':len(rows),'coefficients':final,'features':names,'lambda':penalty,
      'priorType':selected['priorType'],'regularPrior':{'eligibleGames':len(regular),'coefficients':priors[2025],'minimumPriorDecisions':30,'fit':'unpenalized logistic; prior-calendar-date features only'},
      'familyComparison':family_comparison,
      'selection':{'metric':'logLoss','validationSeasons':'2014–2022 expanding window','candidates':candidates},
      'holdout':{'period':'2023–2025','trainedThrough':2022,'coefficients':frozen,'adjusted':metrics(held,hp),'baseline':metrics(held,baseline),'yearly':yearly,'calibration':calibration},
      'coefficientIntervals':{'method':'season-cluster percentile bootstrap, selected specification fixed','replicates':bootstrap,'seed':20261105,'intervals95':intervals},
      'initialTeams':initial,'seasonSummary':season_summary,'exclusions':exclusions,
      'inputHashes':{f:hashlib.sha256((data_dir/f).read_bytes()).hexdigest() for f in ['regular.csv','postseason.json']},
      'sources':{'schedule':'https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList','gameAudit':'https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList','calendar':'https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=12183'},
      'limitations':['Small postseason sample; predictive associations, not causal rest effects','Retrospective exploratory comparison, not a preregistered prospective forecast','Held-out evaluation uses a frozen pre-2023 fit; deployment refits through 2025','Bootstrap intervals condition on selected features and regularization','No individual starters, bullpen pitch counts or injury adjustments','Rest and recent-game fatigue were estimated as candidates but excluded by earlier-season validation','Strength is held fixed at the pre-postseason regular-season snapshot','Constant log-odds WP correction remains an approximation']}
    output.mkdir(parents=True,exist_ok=True)
    (output/'model-fit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    production={k:report[k] for k in ['id','status','available','checkedAt','trainingPeriod','sampleSize','coefficients','features','lambda','priorType','regularPrior','initialTeams','holdout','coefficientIntervals','limitations','sources']}
    (output/'fitted-model.mjs').write_text('export const fittedModel = '+json.dumps(production,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    (data_dir/'training-features.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'n':len(rows),'chosen':selected,'coefficients':final,'intervals':intervals,'holdout':report['holdout'],'excluded':exclusions},ensure_ascii=False,indent=2))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--data-dir',type=Path,default=Path('estimation/data'));parser.add_argument('--output',type=Path,default=Path('.'));parser.add_argument('--bootstrap',type=int,default=500)
    a=parser.parse_args();run(a.data_dir,a.output,a.bootstrap)
