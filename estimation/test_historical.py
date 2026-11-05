import contextlib, csv, io, json, math, shutil, tempfile, unittest
from pathlib import Path
import numpy as np
from fit_historical import prepare, regular_features, fit, predict, metrics, run, read_csv
DATA=Path(__file__).parent/'data'
ROOT=Path(__file__).resolve().parent.parent

class HistoricalFitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows,cls.initial,cls.summary,cls.exclusions=prepare(DATA)
        cls.regular=regular_features(DATA)
        cls.report=json.loads((ROOT/'model-fit.json').read_text(encoding='utf-8'))

    def test_real_source_coverage_and_activity_exceptions(self):
        self.assertEqual(len(self.rows),229);self.assertEqual(len(self.regular),8130)
        self.assertEqual(sum(s['regularGamesBeforePS'] for s in self.summary),11388)
        row=next(r for r in self.rows if r['season']==2024 and r['stage']=='WC' and r['number']==1)
        self.assertEqual(row['restDays']['KT'],0)
        self.assertTrue(all(r['strengthLatestDate']<r['date'] for r in self.rows))
        self.assertEqual({r['id'] for r in self.exclusions},{'20241021SSHT0','20241023SSHT0'})

    def test_empirical_center_satisfies_penalized_likelihood_gradient(self):
        names=['strength','home'];prior=fit(self.regular,names,0)
        b=fit(self.rows,names,1,prior)
        x=np.array([[r['features'][f] for f in names] for r in self.rows]);y=np.array([r['homeWin'] for r in self.rows])
        gradient=x.T@(predict(self.rows,b)-y)/len(y)+np.mean(x*x,axis=0)*np.array([b[f]-prior[f] for f in names])
        self.assertLess(np.max(np.abs(gradient)),1e-7)
        for f in names:self.assertAlmostEqual(b[f],self.report['coefficients'][f],places=10)

    def test_frozen_holdout_metrics_reproduce_without_deployment_fit(self):
        train=[r for r in self.rows if r['season']<=2022];held=[r for r in self.rows if r['season']>=2023]
        prior=fit([r for r in self.regular if r['season']<=2022],['strength','home'],0)
        b=fit(train,['strength','home'],1,prior);score=metrics(held,predict(held,b))
        self.assertEqual(len(held),44)
        self.assertAlmostEqual(score['logLoss'],self.report['holdout']['adjusted']['logLoss'],places=12)

    def test_future_outcomes_cannot_change_selection_or_pre2023_fit(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'estimation') as tmp:
            root=Path(tmp).resolve();self.assertTrue(root.is_relative_to(ROOT));data=root/'data';shutil.copytree(DATA,data)
            ps=json.loads((data/'postseason.json').read_text(encoding='utf-8'))
            for r in ps:
                if r['season']>=2023:r['homeScore'],r['awayScore']=r['awayScore'],r['homeScore']
            (data/'postseason.json').write_text(json.dumps(ps,ensure_ascii=False),encoding='utf-8')
            with contextlib.redirect_stdout(io.StringIO()):
                run(DATA,root/'reference',bootstrap=2)
                run(data,root/'output',bootstrap=2)
            reference=json.loads((root/'reference/model-fit.json').read_text(encoding='utf-8'))
            changed=json.loads((root/'output/model-fit.json').read_text(encoding='utf-8'))
            self.assertEqual(changed['selection'],reference['selection'])
            self.assertEqual(changed['holdout']['coefficients'],reference['holdout']['coefficients'])
            self.assertNotEqual(changed['holdout']['adjusted'],reference['holdout']['adjusted'])

    def test_future_regular_records_cannot_enter_pregame_features(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'estimation') as tmp:
            root=Path(tmp).resolve();self.assertTrue(root.is_relative_to(ROOT))
            records=read_csv(DATA/'regular.csv')
            boundary='2018-07-01'
            for r in records:
                if r['date']>=boundary:r['homeScore'],r['awayScore']=r['awayScore'],r['homeScore']
            with (root/'regular.csv').open('w',newline='',encoding='utf-8') as f:
                writer=csv.DictWriter(f,fieldnames=records[0].keys());writer.writeheader();writer.writerows(records)
            changed=regular_features(root)
            before=lambda rows:[r for r in rows if r['date']<boundary]
            self.assertEqual(before(changed),before(self.regular))

if __name__=='__main__':unittest.main()
