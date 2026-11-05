import contextlib,io,json,math,shutil,tempfile,unittest
from pathlib import Path
import numpy as np
from fit_fatigue import prepare_fatigue,fatigue_features,workload,run
from fit_historical import DAY,fit,predict,metrics,read_csv
ROOT=Path(__file__).resolve().parent.parent;DATA=ROOT/'estimation/data'
class FatigueFitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ps,cls.reg,cls.initial,_,_=prepare_fatigue(DATA)
        cls.report=json.loads((ROOT/'model-fit.json').read_text(encoding='utf-8'))
    def test_workload_definition_and_sign(self):
        self.assertAlmostEqual(workload([DAY('2020-10-10')],DAY('2020-10-11'),7),1)
        x=fatigue_features('H','A','2020-10-12',{'H':[DAY('2020-10-09')],'A':[DAY('2020-10-10'),DAY('2020-10-11')]})
        self.assertGreater(x['load7'],0)
    def test_final_coefficients_and_frozen_evaluation_reproduce(self):
        names=['strength','home','load7'];b=fit(self.ps,names,1,fit(self.reg,names,0))
        for f in names:self.assertAlmostEqual(b[f],self.report['coefficients'][f],places=10)
        train=[r for r in self.ps if r['season']<=2022];held=[r for r in self.ps if r['season']>=2023]
        frozen=fit(train,names,1,fit([r for r in self.reg if r['season']<=2022],names,0))
        self.assertAlmostEqual(metrics(held,predict(held,frozen))['logLoss'],self.report['holdout']['adjusted']['logLoss'],places=12)
        self.assertEqual(len(self.ps),229);self.assertEqual(len(self.reg),8130)
    def test_future_ps_results_cannot_change_selection_or_frozen_coefficients(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'estimation') as tmp:
            root=Path(tmp).resolve();self.assertTrue(root.is_relative_to(ROOT));data=root/'data';shutil.copytree(DATA,data)
            ps=json.loads((data/'postseason.json').read_text(encoding='utf-8'))
            for g in ps:
                if g['season']>=2023:g['homeScore'],g['awayScore']=g['awayScore'],g['homeScore']
            (data/'postseason.json').write_text(json.dumps(ps),encoding='utf-8')
            with contextlib.redirect_stdout(io.StringIO()):run(DATA,root/'ref',bootstrap=2);run(data,root/'changed',bootstrap=2)
            a=json.loads((root/'ref/model-fit.json').read_text(encoding='utf-8'));b=json.loads((root/'changed/model-fit.json').read_text(encoding='utf-8'))
            self.assertEqual(a['selection'],b['selection']);self.assertEqual(a['holdout']['coefficients'],b['holdout']['coefficients'])
            self.assertNotEqual(a['holdout']['adjusted'],b['holdout']['adjusted'])
    def test_preseason_2026_activity_and_cross_language_load_fixture(self):
        dates=self.initial['삼성']['activityDates'];self.assertEqual(len(dates),144)
        self.assertTrue(all(d<'2026-10-14' for d in dates))
        fixture=workload([DAY(d) for d in dates],DAY('2026-10-14'),7)
        self.assertGreater(fixture,0)
        # All historical training values retained in the published audit must agree.
        published=json.loads((ROOT/'fatigue-training-features.json').read_text(encoding='utf-8'))
        for actual,expected in zip(self.ps,published):
            self.assertEqual(actual['id'],expected['id'])
            self.assertAlmostEqual(actual['features']['load7'],expected['features']['load7'],places=12)
if __name__=='__main__':unittest.main()
