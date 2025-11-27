import React, { useState, useEffect } from 'react';
import { Trophy, Shield, Goal, AlertCircle, RefreshCw, Coins, ArrowRight, CheckCircle2, Download, Search, Loader2, ExternalLink, ChevronDown, ChevronUp, User, Plus, Trash2, Banknote } from 'lucide-react';

export default function FplTieBreaker() {
  // Initialize state from LocalStorage if available
  const [teams, setTeams] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTeams = localStorage.getItem('fpl_tie_breaker_teams');
      if (savedTeams) {
        try {
          // Merge saved data with default structure to handle new fields like 'value'
          const parsed = JSON.parse(savedTeams);
          return parsed.map(t => ({
            value: '', // Ensure value exists for old saves
            ...t
          }));
        } catch (e) {
          console.error("Failed to parse saved teams", e);
        }
      }
    }
    return [
      { id: '', name: 'Team 1', score: '', goals: '', conceded: '', value: '', scorers: [], conceders: [] },
      { id: '', name: 'Team 2', score: '', goals: '', conceded: '', value: '', scorers: [], conceders: [] }
    ];
  });

  const [gameweek, setGameweek] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('fpl_tie_breaker_gameweek') || '';
    }
    return '';
  });

  const [analysis, setAnalysis] = useState(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [coinWinnerIndex, setCoinWinnerIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [staticData, setStaticData] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fpl_tie_breaker_teams', JSON.stringify(teams));
      localStorage.setItem('fpl_tie_breaker_gameweek', gameweek);
    }
  }, [teams, gameweek]);

  useEffect(() => {
    const fetchStatic = async () => {
      try {
        const proxyUrl = "https://corsproxy.io/?";
        const res = await fetch(proxyUrl + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"));
        if (res.ok) {
          const data = await res.json();
          setStaticData(data);
        }
      } catch (e) {
        console.error("Failed to load player database", e);
      }
    };
    fetchStatic();
  }, []);

  // --- Core Tie Breaker Logic ---
  const calculateWinner = () => {
    const parsedTeams = teams.map((t, idx) => ({
      ...t,
      originalIndex: idx,
      scoreNum: Number(t.score) || 0,
      goalsNum: Number(t.goals) || 0,
      concededNum: Number(t.conceded) || 0
    }));

    const hasInputs = parsedTeams.some(t => t.score !== '');
    if (!hasInputs) {
      setAnalysis(null);
      return;
    }

    // Step 1: Score
    const maxScore = Math.max(...parsedTeams.map(t => t.scoreNum));
    const step1Survivors = parsedTeams.filter(t => t.scoreNum === maxScore);

    // Step 2: Goals Scored
    let step2Survivors = step1Survivors;
    let maxGoals = 0;
    if (step1Survivors.length > 1) {
      maxGoals = Math.max(...step1Survivors.map(t => t.goalsNum));
      step2Survivors = step1Survivors.filter(t => t.goalsNum === maxGoals);
    }

    // Step 3: Goals Conceded
    let step3Survivors = step2Survivors;
    let minConceded = 0;
    if (step2Survivors.length > 1) {
      minConceded = Math.min(...step2Survivors.map(t => t.concededNum));
      step3Survivors = step2Survivors.filter(t => t.concededNum === minConceded);
    }

    // Step 4: Coin Toss
    let finalWinner = null;
    let winReason = '';
    let winningStep = 0;

    if (step1Survivors.length === 1) {
        finalWinner = step1Survivors[0];
        winReason = 'Higher Gameweek Score';
        winningStep = 1;
    } else if (step2Survivors.length === 1) {
        finalWinner = step2Survivors[0];
        winReason = 'More Goals Scored';
        winningStep = 2;
    } else if (step3Survivors.length === 1) {
        finalWinner = step3Survivors[0];
        winReason = 'Fewer Goals Conceded';
        winningStep = 3;
    } else {
        if (coinWinnerIndex !== null) {
            const stillValid = step3Survivors.find(t => t.originalIndex === coinWinnerIndex);
            if (stillValid) {
                finalWinner = stillValid;
                winReason = 'Virtual Coin Toss';
                winningStep = 4;
            }
        } else {
             winReason = 'Dead Heat - Coin Toss Required';
             winningStep = 4;
        }
    }

    setAnalysis({
        step1: { survivors: step1Survivors.map(t => t.originalIndex), bestValue: maxScore },
        step2: { survivors: step2Survivors.map(t => t.originalIndex), bestValue: maxGoals },
        step3: { survivors: step3Survivors.map(t => t.originalIndex), bestValue: minConceded },
        winner: finalWinner,
        reason: winReason,
        winningStep
    });
  };

  useEffect(() => {
    calculateWinner();
  }, [teams]);

  useEffect(() => {
     calculateWinner();
  }, [coinWinnerIndex]);

  const handleCoinToss = () => {
    if (!analysis) return;
    const candidates = analysis.step3.survivors;
    if (candidates.length < 2) return;

    setIsFlipping(true);
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      const winnerOriginalIndex = candidates[randomIndex];
      setCoinWinnerIndex(winnerOriginalIndex);
      setIsFlipping(false);
    }, 1500);
  };

  const handleReset = () => {
    const defaultTeams = [
        { id: '', name: 'Team 1', score: '', goals: '', conceded: '', value: '', scorers: [], conceders: [] },
        { id: '', name: 'Team 2', score: '', goals: '', conceded: '', value: '', scorers: [], conceders: [] }
    ];
    setTeams(defaultTeams);
    setGameweek('');
    setCoinWinnerIndex(null);
    setAnalysis(null);
    setError(null);
    
    if (typeof window !== 'undefined') {
        localStorage.removeItem('fpl_tie_breaker_teams');
        localStorage.removeItem('fpl_tie_breaker_gameweek');
    }
  };

  const updateTeam = (index, field, value) => {
    const newTeams = [...teams];
    newTeams[index] = { ...newTeams[index], [field]: value };
    setCoinWinnerIndex(null);
    setTeams(newTeams);
  };

  const addTeam = () => {
    if (teams.length < 5) {
        setTeams([...teams, { id: '', name: `Team ${teams.length + 1}`, score: '', goals: '', conceded: '', value: '', scorers: [], conceders: [] }]);
        setCoinWinnerIndex(null);
    }
  };

  const removeTeam = (index) => {
      if (teams.length > 2) {
          const newTeams = teams.filter((_, i) => i !== index);
          setTeams(newTeams);
          setCoinWinnerIndex(null);
      }
  };


  // --- API Fetching Logic ---

  const fetchFPLData = async () => {
    const activeIndices = teams.map((t, i) => t.id ? i : -1).filter(i => i !== -1);

    if (!gameweek || activeIndices.length < 2) {
      setError("Please enter Gameweek and at least two Team IDs.");
      return;
    }

    setLoading(true);
    setError(null);
    setCoinWinnerIndex(null);

    try {
      const proxyUrl = "https://corsproxy.io/?";
      const liveUrl = `${proxyUrl}${encodeURIComponent(`https://fantasy.premierleague.com/api/event/${gameweek}/live/`)}`;
      
      const liveRes = await fetch(liveUrl);
      if (!liveRes.ok) throw new Error("Failed to fetch live data. Check Gameweek.");
      const liveData = await liveRes.json();

      const teamPromises = activeIndices.map(async (index) => {
         const teamId = teams[index].id;
         const picksUrl = `${proxyUrl}${encodeURIComponent(`https://fantasy.premierleague.com/api/entry/${teamId}/event/${gameweek}/picks/`)}`;
         const detailsUrl = `${proxyUrl}${encodeURIComponent(`https://fantasy.premierleague.com/api/entry/${teamId}/`)}`;
         
         const [picksRes, detailsRes] = await Promise.all([fetch(picksUrl), fetch(detailsUrl)]);
         if (!picksRes.ok) throw new Error(`Failed to fetch team ${teamId}`);
         
         const picksData = await picksRes.json();
         const detailsData = await detailsRes.json();
         
         return { index, picksData, detailsData };
      });

      const results = await Promise.all(teamPromises);

      const newTeams = [...teams];

      results.forEach(({ index, picksData, detailsData }) => {
        const isBenchBoost = picksData.active_chip === 'bboost';
        let activePicks = [];

        if (isBenchBoost) {
          activePicks = picksData.picks;
        } else {
          let starters = picksData.picks.filter(p => p.position <= 11);
          const subs = picksData.picks.filter(p => p.position > 11);

          if (picksData.automatic_subs && picksData.automatic_subs.length > 0) {
            picksData.automatic_subs.forEach(sub => {
               starters = starters.filter(p => p.element !== sub.element_out);
               const playerIn = subs.find(p => p.element === sub.element_in);
               if (playerIn) starters.push(playerIn);
            });
          }
          activePicks = starters;
        }

        let totalGoals = 0;
        let totalConceded = 0;
        const scorersList = [];
        const concedersList = [];

        activePicks.forEach(pick => {
          const playerStats = liveData.elements.find(el => el.id === pick.element)?.stats;
          const playerDef = staticData?.elements?.find(el => el.id === pick.element);
          const playerName = playerDef ? playerDef.web_name : `Player ${pick.element}`;

          if (playerStats) {
            totalGoals += playerStats.goals_scored;
            totalConceded += playerStats.goals_conceded;

            if (playerStats.goals_scored > 0) {
              scorersList.push({ name: playerName, count: playerStats.goals_scored });
            }
            if (playerStats.goals_conceded > 0) {
              concedersList.push({ name: playerName, count: playerStats.goals_conceded });
            }
          }
        });

        const rawPoints = picksData.entry_history.points;
        const transferCost = picksData.entry_history.event_transfers_cost;
        const totalPoints = rawPoints - transferCost;
        
        // Calculate Team Value (FPL returns integer e.g. 1025 for 102.5)
        const rawValue = picksData.entry_history.value;
        const formattedValue = rawValue ? (rawValue / 10).toFixed(1) : '';

        newTeams[index] = {
            ...newTeams[index],
            name: `${detailsData.player_first_name} ${detailsData.player_last_name}`,
            score: totalPoints,
            goals: totalGoals,
            conceded: totalConceded,
            value: formattedValue,
            scorers: scorersList,
            conceders: concedersList
        };
      });

      setTeams(newTeams);

    } catch (err) {
      console.error(err);
      setError("Error fetching data. Ensure IDs are correct and Gameweek is active. Note: FPL API updates during live games may delay.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      
      {/* FPL Header */}
      <header className="bg-[#37003c] border-b border-purple-900 sticky top-0 z-50 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:px-8">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 bg-[#00ff85] rounded-md flex items-center justify-center text-[#37003c] font-bold shadow-sm">
                <Trophy className="h-6 w-6" />
             </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">Cup <span className="text-[#00ff85]">Resolver</span></h1>
              <p className="text-purple-200 text-xs uppercase tracking-widest font-semibold opacity-80">Official Tie-Breaker Tool</p>
            </div>
          </div>
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded transition-colors text-xs font-bold uppercase tracking-wider text-white w-fit"
          >
            <RefreshCw className="h-3 w-3" />
            Reset All
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">

        {/* API Fetch Controls */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-[#37003c] font-black uppercase text-xs tracking-widest">
            <Download className="h-4 w-4" />
            Import Stats
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 items-end">
             <div className="w-full md:w-32">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Gameweek</label>
                <input 
                  type="number" 
                  value={gameweek}
                  onChange={(e) => setGameweek(e.target.value)}
                  placeholder="GW"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded focus:border-[#37003c] focus:ring-1 focus:ring-[#37003c] outline-none font-medium text-sm transition-all"
                />
             </div>
             <div className="flex-1 w-full text-xs text-slate-500 pb-3 leading-relaxed">
                Enter <span className="text-[#37003c] font-bold">Team IDs</span> in the cards below to auto-fetch scores. <br className="hidden md:block"/>
                <span className="opacity-70">Transfer hits are automatically deducted from the GW Score.</span>
             </div>
             <div className="w-full md:w-48">
                <button 
                  onClick={fetchFPLData}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 p-2.5 bg-[#00ff85] hover:bg-[#00e676] text-[#37003c] font-black uppercase tracking-wide text-sm rounded transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 shadow-sm"
                >
                  {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                  {loading ? 'Fetching...' : 'Fetch Data'}
                </button>
             </div>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-red-500" />
              {error}
            </div>
          )}
        </div>
        
        {/* Teams Grid */}
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#37003c] uppercase tracking-tight">Contenders</h2>
                {teams.length < 5 && (
                    <button onClick={addTeam} className="text-xs flex items-center gap-1 text-[#37003c] font-bold uppercase hover:bg-slate-100 px-3 py-1.5 rounded transition-colors border border-slate-200 bg-white">
                        <Plus className="h-3 w-3" /> Add Team
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {teams.map((team, idx) => (
                    <TeamCard 
                        key={idx}
                        index={idx}
                        teamData={team} 
                        updateTeam={updateTeam}
                        removeTeam={removeTeam}
                        canRemove={teams.length > 2}
                        isWinner={analysis?.winner?.originalIndex === idx}
                        isEliminated={analysis && !analysis.step1.survivors.includes(idx) && analysis.winningStep >= 1}
                        gameweek={gameweek}
                    />
                ))}
            </div>
        </div>

        {/* Result Section */}
        {analysis && (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Verdict Header */}
            {analysis.winner ? (
                 <div className="p-8 text-center bg-gradient-to-br from-[#37003c] to-[#240028] text-white">
                    <div className="inline-flex p-3 rounded-full bg-white/10 mb-4 ring-1 ring-white/20">
                         <Trophy className="h-8 w-8 text-[#00ff85]" />
                    </div>
                    <h3 className="text-3xl font-black uppercase tracking-tight mb-2">
                        {analysis.winner.name} Wins
                    </h3>
                    <div className="inline-block px-3 py-1 bg-[#00ff85] text-[#37003c] text-xs font-bold uppercase rounded-sm">
                        {analysis.reason}
                    </div>
                </div>
            ) : (
                <div className="p-6 text-center bg-slate-50 border-b border-slate-200">
                    <h3 className="text-2xl font-bold text-slate-800">Tie Break In Progress</h3>
                    <p className="text-slate-500 text-sm mt-1">Multiple teams tied across all stats.</p>
                </div>
            )}

            <div className="p-6 md:p-8 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Tie-Breaker Steps</h4>
                
                {/* Step 1: Score */}
                <AnalysisStep 
                    step={1}
                    label="GW Score"
                    icon={<Trophy className="h-4 w-4" />}
                    teams={teams}
                    survivors={analysis.step1.survivors}
                    bestValue={analysis.step1.bestValue}
                    isDecisive={analysis.winningStep === 1}
                    isPast={analysis.winningStep > 1}
                />

                {/* Step 2: Goals */}
                <AnalysisStep 
                    step={2}
                    label="Goals"
                    subLabel="(Scored)"
                    icon={<Goal className="h-4 w-4" />}
                    teams={teams}
                    survivors={analysis.step2.survivors}
                    bestValue={analysis.step2.bestValue}
                    isDecisive={analysis.winningStep === 2}
                    isPast={analysis.winningStep > 2}
                    isHidden={analysis.winningStep < 1} // Only show if we passed step 1
                />

                {/* Step 3: Conceded */}
                <AnalysisStep 
                    step={3}
                    label="Conceded"
                    subLabel="(Allowed)"
                    icon={<Shield className="h-4 w-4" />}
                    teams={teams}
                    survivors={analysis.step3.survivors}
                    bestValue={analysis.step3.bestValue}
                    isDecisive={analysis.winningStep === 3}
                    isPast={analysis.winningStep > 3}
                    isHidden={analysis.winningStep < 2}
                    reverseLogic={true}
                />

                {/* Step 4: Coin Toss */}
                {!analysis.winner && analysis.step3.survivors.length > 1 && (
                    <div className={`transition-opacity duration-500`}>
                        <div className="flex flex-col md:flex-row items-center justify-between p-6 rounded-lg border border-purple-200 bg-purple-50 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full flex items-center justify-center bg-[#37003c] text-white shadow-lg">
                                <Coins className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="font-bold text-[#37003c] text-lg">Virtual Coin Toss</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wide">
                                    {analysis.step3.survivors.length} teams still tied
                                </div>
                            </div>
                        </div>
                        
                        {!coinWinnerIndex && (
                            <button 
                                onClick={handleCoinToss}
                                disabled={isFlipping}
                                className="px-6 py-3 bg-[#e90052] hover:bg-[#c20044] text-white font-black uppercase tracking-wide text-sm rounded shadow-lg shadow-[#e90052]/20 transition-all active:scale-95 flex items-center gap-2"
                            >
                                {isFlipping ? <RefreshCw className="animate-spin h-4 w-4" /> : <Coins className="h-4 w-4" />}
                                {isFlipping ? 'FLIP NOW' : 'FLIP COIN'}
                            </button>
                        )}
                        </div>
                    </div>
                )}
            </div>
            </div>
        )}

      </main>
    </div>
  );
}

function TeamCard({ index, teamData, updateTeam, removeTeam, canRemove, isWinner, isEliminated, gameweek }) {
  const [showDetails, setShowDetails] = useState(false);
  const hasDetails = (teamData.scorers?.length > 0 || teamData.conceders?.length > 0);

  const cardStyle = isWinner 
    ? 'border-emerald-400 bg-emerald-50 shadow-md ring-2 ring-emerald-100 z-10' 
    : isEliminated 
        ? 'border-slate-100 bg-slate-50 opacity-60 grayscale' 
        : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm';

  return (
    <div className={`rounded-xl border p-5 transition-all duration-300 relative flex flex-col h-full ${cardStyle}`}>
      {/* Remove Button */}
      {canRemove && (
        <button 
            onClick={() => removeTeam(index)}
            className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-full hover:bg-slate-100"
        >
            <Trash2 className="h-3 w-3" />
        </button>
      )}

      <div className="mb-6">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
          Team {index + 1}
        </label>
        <input 
          type="text" 
          value={teamData.name}
          onChange={(e) => updateTeam(index, 'name', e.target.value)}
          className="w-full text-base font-bold bg-transparent border-b border-slate-200 focus:border-[#37003c] focus:outline-none py-1 text-ellipsis overflow-hidden text-slate-900 placeholder:text-slate-300 transition-colors"
          placeholder="Team Name"
        />
        <div className="flex items-center gap-2 mt-2">
            <input 
                type="text" 
                value={teamData.id}
                onChange={(e) => updateTeam(index, 'id', e.target.value)}
                placeholder="ID"
                className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 w-20 focus:outline-none focus:border-[#37003c] text-slate-600 font-mono"
            />
            {teamData.id && gameweek && (
                <a 
                href={`https://fantasy.premierleague.com/entry/${teamData.id}/event/${gameweek}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs font-bold text-[#e90052] hover:text-[#c20044] hover:underline flex items-center gap-1 uppercase"
                >
                FPL <ExternalLink className="h-2 w-2" />
                </a>
            )}
        </div>
      </div>

      <div className="space-y-4 flex-1">
        {/* Main Score Display */}
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
             <label className="text-xs font-bold text-slate-500 uppercase">Points</label>
             <input 
                type="number" 
                min="0"
                value={teamData.score}
                onChange={(e) => updateTeam(index, 'score', e.target.value)}
                className="w-20 bg-transparent text-right text-2xl font-black text-slate-900 focus:outline-none placeholder:text-slate-200"
                placeholder="0"
             />
        </div>

        <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Goals</label>
                <input 
                    type="number" 
                    min="0"
                    value={teamData.goals}
                    onChange={(e) => updateTeam(index, 'goals', e.target.value)}
                    className="w-full bg-transparent text-base font-bold text-slate-700 focus:outline-none placeholder:text-slate-200"
                    placeholder="0"
                />
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Conceded</label>
                <input 
                    type="number" 
                    min="0"
                    value={teamData.conceded}
                    onChange={(e) => updateTeam(index, 'conceded', e.target.value)}
                    className="w-full bg-transparent text-base font-bold text-slate-700 focus:outline-none placeholder:text-slate-200"
                    placeholder="0"
                />
            </div>
            
            {/* Added Team Value */}
            <div className="col-span-2 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                   <Banknote className="h-3 w-3" /> Value (£m)
                </label>
                <input 
                    type="number"
                    step="0.1" 
                    min="0"
                    value={teamData.value}
                    onChange={(e) => updateTeam(index, 'value', e.target.value)}
                    className="w-20 bg-transparent text-right text-sm font-bold text-slate-600 focus:outline-none placeholder:text-slate-300"
                    placeholder="0.0"
                />
            </div>
        </div>
      </div>

      {hasDetails && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-400 uppercase hover:text-[#37003c] transition-colors"
          >
            <span>Details</span>
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          
          {showDetails && (
            <div className="mt-2 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
               {teamData.scorers?.length > 0 && (
                 <div>
                    <h5 className="text-xs font-bold text-[#e90052] uppercase mb-1 flex items-center gap-1">
                       <Goal className="h-3 w-3" /> Scorers
                    </h5>
                    <ul className="space-y-1">
                      {teamData.scorers.map((player, i) => (
                        <li key={i} className="text-xs flex items-center justify-between bg-slate-50 p-1.5 rounded border border-slate-100">
                          <span className="truncate max-w-[80px] text-slate-600" title={player.name}>{player.name}</span>
                          <span className="text-[#37003c] font-mono font-bold">x{player.count}</span>
                        </li>
                      ))}
                    </ul>
                 </div>
               )}
                {teamData.conceders?.length > 0 && (
                 <div>
                    <h5 className="text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                       <Shield className="h-3 w-3" /> Conceded
                    </h5>
                    <div className="bg-slate-50 rounded p-1.5 max-h-24 overflow-y-auto border border-slate-100">
                      {teamData.conceders.map((player, i) => (
                         <div key={i} className="text-xs flex items-center justify-between py-0.5">
                             <span className="truncate max-w-[80px] text-slate-500" title={player.name}>{player.name}</span>
                             <span className="text-red-400 font-mono">-{player.count}</span>
                         </div>
                      ))}
                    </div>
                 </div>
               )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InputGroup({ label, value, onChange, highlight }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <input 
        type="number" 
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-16 p-1.5 text-right rounded border text-sm ${highlight ? 'border-purple-200 bg-purple-50 text-purple-900 font-bold' : 'border-slate-200 text-slate-700'} focus:ring-1 focus:ring-purple-300 outline-none`}
      />
    </div>
  );
}

function AnalysisStep({ step, label, subLabel, icon, teams, survivors, bestValue, isDecisive, isPast, isHidden, reverseLogic }) {
    if (isHidden) return null;

    const bgClass = isDecisive 
        ? 'bg-white border-emerald-400 shadow-md ring-1 ring-emerald-100' 
        : isPast 
            ? 'bg-slate-50 border-slate-200 opacity-60' 
            : 'bg-white border-slate-200';

    const iconBg = isDecisive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500';

    return (
        <div className={`rounded-lg border transition-all duration-300 overflow-hidden ${bgClass}`}>
            <div className="p-4 flex items-center gap-4">
                <div className={`h-8 w-8 rounded flex items-center justify-center shrink-0 ${iconBg}`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-bold text-sm uppercase tracking-wide flex items-center gap-2 text-slate-700">
                                {label}
                                {subLabel && <span className={`text-xs font-normal normal-case ${isDecisive ? 'text-slate-500' : 'text-slate-400'} hidden sm:inline-block`}>{subLabel}</span>}
                            </div>
                            {isDecisive && <div className="text-xs font-bold uppercase tracking-widest text-emerald-600">Deciding Factor</div>}
                        </div>
                        {/* Display the Best Value */}
                        {(isDecisive || isPast) && (
                            <div className="text-xl font-black font-mono text-slate-800">
                                {bestValue}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Survivors Bar */}
            {(isDecisive || isPast) && (
                <div className={`p-2 flex flex-wrap gap-2 ${isDecisive ? 'bg-emerald-50/50' : 'bg-slate-50'}`}>
                    {teams.map((team, idx) => {
                        let val = 0;
                        if (step === 1) val = Number(team.score) || 0;
                        if (step === 2) val = Number(team.goals) || 0;
                        if (step === 3) val = Number(team.conceded) || 0;

                        const isSurvivor = survivors.includes(idx);
                        
                        // Style based on survivor status
                        const badgeClass = isSurvivor 
                            ? (isDecisive ? 'bg-white text-emerald-700 font-bold border-emerald-200 shadow-sm' : 'bg-white text-emerald-600 border-slate-200')
                            : 'bg-transparent text-slate-400 border-transparent decoration-line-through';

                        return (
                            <div key={idx} className={`text-xs px-2 py-0.5 rounded border flex items-center gap-2 ${badgeClass}`}>
                                <span className="uppercase tracking-wider">{team.name}</span>
                                <span className="font-mono">{val}</span>
                                {isSurvivor && <CheckCircle2 className="h-3 w-3" />}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}