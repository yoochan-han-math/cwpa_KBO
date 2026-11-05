import {teams,stages} from './model.mjs';
import {fittedModel} from './fitted-model.mjs';
import {plannedCalendar} from './postseason-calendar.mjs';
const day = iso => {const n=Date.parse(iso+'T00:00:00Z')/86400000;if(!Number.isInteger(n))throw Error('Invalid calendar date');return n;};
const iso = d => new Date(d*86400000).toISOString().slice(0,10);
const schedule = new Map(plannedCalendar.games.map(g=>[g.stage+'-'+g.number,day(g.date)]));
const plannedDay = st => {const d=schedule.get(stages[st.s]+'-'+(st.a+st.b+1));if(d==null)throw Error('Missing planned game date');return d;};
export function calendarLoad(dates,date,tau=7){const d=day(date);return dates.reduce((s,date)=>{const n=day(date);if(n>=d)throw Error('Future activity in pregame workload');return s+Math.exp(-(d-n-1)/tau);},0);}
export function fatigueAdapter({enabled=true}={}) {
  const tau=fittedModel.fatigue.tauDays;
  return {
    initial(st){const d=plannedDay(st);return {...st,day:d,shift:0,lastPlayed:null,
      loads:Object.fromEntries(teams.map(t=>[t,calendarLoad(fittedModel.initialTeams[t].activityDates,iso(d),tau)])),
      lastDates:Object.fromEntries(teams.map(t=>[t,day(fittedModel.initialTeams[t].lastDate)]))};},
    context(st,c){
      const difference=st.loads[c.away]-st.loads[c.home],b=fittedModel.coefficients;
      const baseLogit=b.strength*(fittedModel.initialTeams[c.home].strength-fittedModel.initialTeams[c.away].strength)+b.home;
      const withoutFatigue=1/(1+Math.exp(-baseLogit)),withFatigue=1/(1+Math.exp(-(baseLogit+(enabled?b.load7*difference:0))));
      return {...c,date:iso(st.day),fatigue:{date:iso(st.day),homeLoad:st.loads[c.home],awayLoad:st.loads[c.away],difference,
        homeRestDays:st.day-st.lastDates[c.home]-1,awayRestDays:st.day-st.lastDates[c.away]-1,
        withoutFatigue,homePrior:withFatigue,homeEffectPP:(withFatigue-withoutFatigue)*100,enabled}};
    },
    advance(st,next,c){
      if(next.champion)return next;
      const d=Math.max(plannedDay(next)+st.shift,st.day+(next.s===st.s?1:2));
      const loads=Object.fromEntries(teams.map(t=>[t,st.loads[t]*Math.exp(-(d-st.day)/tau)+([c.home,c.away].includes(t)?Math.exp(-(d-st.day-1)/tau):0)]));
      return {...next,day:d,shift:st.shift,lastPlayed:st.day,loads,lastDates:{...st.lastDates,[c.home]:st.day,[c.away]:st.day}};
    },
    observe(st,g){
      const d=day(g.date);
      if(d<day('2026-10-14') || (st.lastPlayed!==null && d<=st.lastPlayed))throw Error('Nonchronological observed game');
      if(d===st.day)return st;
      return {...st,day:d,shift:Math.max(st.shift,d-plannedDay(st)),loads:Object.fromEntries(teams.map(t=>[t,st.loads[t]*Math.exp(-(d-st.day)/tau)]))};
    }
  };
}
