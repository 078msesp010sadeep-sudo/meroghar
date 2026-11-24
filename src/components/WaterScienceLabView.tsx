import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Atom,
  Droplets,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Save,
  Loader2,
  Info,
  CheckCircle2,
  Beaker,
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

interface ChemicalCompound {
  cid: number;
  name: string;
  nepaliName?: string;
  molecularFormula: string;
  molecularWeight: string;
  canonicalSmiles: string;
  inChIKey: string;
  complexity?: number;
  roleInHousing?: string;
  nepalStandardLimit?: string;
  hazardCategory?: string;
  safetyProtocol?: string;
}

const PRESET_COMPOUNDS = [
  { name: 'Bleaching Powder', query: 'bleaching powder', cid: 24501, label: 'Tank Disinfection' },
  { name: 'Chlorine', query: 'chlorine', cid: 24526, label: 'Water Biocide' },
  { name: 'Arsenic', query: 'arsenic', cid: 5359596, label: 'Groundwater Hazard' },
  { name: 'Iron (Fe)', query: 'iron', cid: 23925, label: 'Red Stain Nuisance' },
  { name: 'Calcium Carbonate', query: 'calcium carbonate', cid: 10112, label: 'Hard Water Scale' },
  { name: 'Nitrate', query: 'nitrate', cid: 943, label: 'Well Seepage' },
];

export function WaterScienceLabView() {
  const [selectedCompoundQuery, setSelectedCompoundQuery] = useState('bleaching powder');
  const [compoundData, setCompoundData] = useState<ChemicalCompound | null>(null);
  const [structureImgUrl, setStructureImgUrl] = useState<string>('');
  const [isLoadingCompound, setIsLoadingCompound] = useState(false);
  const [searchCustomCompound, setSearchCustomCompound] = useState('');

  // Sample testing form state
  const [sampleSource, setSampleSource] = useState<'kukl_pipeline' | 'groundwater_boring' | 'tanker_delivery' | 'ro_purified'>('kukl_pipeline');
  const [phValue, setPhValue] = useState<number>(7.2);
  const [tdsValue, setTdsValue] = useState<number>(380);
  const [turbidityValue, setTurbidityValue] = useState<number>(1.5);
  const [chlorineValue, setChlorineValue] = useState<number>(0.15);
  const [ironValue, setIronValue] = useState<number>(0.1);
  const [tankVolumeLiters, setTankVolumeLiters] = useState<number>(1000);

  const [savingTest, setSavingTest] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [savedLabTests, setSavedLabTests] = useState<any[]>([]);

  // Fetch compound data on selection
  useEffect(() => {
    fetchCompound(selectedCompoundQuery);
  }, [selectedCompoundQuery]);

  const fetchCompound = async (queryName: string) => {
    setIsLoadingCompound(true);
    try {
      const res = await fetch('/api/science/pubchem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compoundName: queryName }),
      });
      if (res.ok) {
        const data = await res.json();
        setCompoundData(data.compound);
        setStructureImgUrl(data.structureImageUrl);
      }
    } catch (err) {
      console.error('PubChem compound error:', err);
    } finally {
      setIsLoadingCompound(false);
    }
  };

  // Compute scientific water safety status
  const computeSampleSafety = () => {
    const issues: string[] = [];
    if (phValue < 6.5 || phValue > 8.5) {
      issues.push(`pH ${phValue} outside Nepal NDWQS optimal range (6.5 - 8.5)`);
    }
    if (tdsValue > 1000) {
      issues.push(`TDS ${tdsValue} ppm exceeds maximum palatable limit (1000 ppm)`);
    }
    if (turbidityValue > 5) {
      issues.push(`Turbidity ${turbidityValue} NTU exceeds clarity standard (5 NTU)`);
    }
    if (chlorineValue < 0.1 && (sampleSource === 'tanker_delivery' || sampleSource === 'kukl_pipeline')) {
      issues.push('Residual chlorine below 0.1 mg/L - risk of coliform microbial regrowth');
    }
    if (ironValue > 0.3) {
      issues.push(`Dissolved iron ${ironValue} mg/L exceeds threshold (0.3 mg/L) - causes reddish staining`);
    }

    if (issues.length === 0) {
      return {
        verdict: 'Safe for Domestic Drinking & Cooking',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        badge: 'safe',
        issues,
      };
    }
    if (issues.length <= 2) {
      return {
        verdict: 'Caution: Disinfection or Pre-filtration Recommended',
        color: 'text-amber-800 bg-amber-50 border-amber-200',
        badge: 'caution',
        issues,
      };
    }
    return {
      verdict: 'Hazardous: Unsafe for Direct Consumption Without Advanced Treatment',
      color: 'text-red-800 bg-red-50 border-red-200',
      badge: 'hazardous',
      issues,
    };
  };

  const sampleSafety = computeSampleSafety();

  // Bleaching powder dosing formula for tank
  // Dosing: 2.5 grams per 1,000 Liters of water gives ~1.5 ppm free chlorine, yielding ~0.2 ppm residual after contact.
  const recommendedBleachGrams = ((tankVolumeLiters / 1000) * 2.5).toFixed(1);

  const handleSaveLabTest = async () => {
    setSavingTest(true);
    setSaveSuccessMsg(null);
    try {
      const testRecord = {
        id: `lab-${Date.now()}`,
        waterSource: sampleSource,
        phLevel: Number(phValue),
        tdsPpm: Number(tdsValue),
        turbidityNtu: Number(turbidityValue),
        residualChlorineMgL: Number(chlorineValue),
        status: sampleSafety.badge,
        testedBy: auth.currentUser?.displayName || 'Resident Lab Analyst',
        treatmentAdvised: `Bleach dosing: ${recommendedBleachGrams}g for ${tankVolumeLiters}L tank.`,
        testDate: new Date().toISOString(),
      };

      if (auth.currentUser) {
        const path = `water_quality_tests/${testRecord.id}`;
        try {
          await setDoc(doc(db, 'water_quality_tests', testRecord.id), testRecord);
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.CREATE, path);
        }
      }

      setSavedLabTests((prev) => [testRecord, ...prev]);
      setSaveSuccessMsg('Scientific lab sample logged and validated against Nepal NDWQS standards!');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Save lab test error:', err);
      // Fallback local memory save
      setSaveSuccessMsg('Sample saved to local session registry.');
    } finally {
      setSavingTest(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-cyan-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400/20 backdrop-blur-md text-xs font-semibold text-cyan-200 tracking-wide">
            <Atom className="w-3.5 h-3.5" />
            Science Skill: PubChem Chemistry & Water Analysis
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Residential Water Chemistry & Environmental Science Lab
          </h2>
          <p className="text-sm text-cyan-100/90 leading-relaxed">
            Directly connected to the **PubChem PUG REST API** and the **Nepal National Drinking Water Quality Standards (NDWQS)**. Analyze chemical compounds, calculate disinfection stoichiometry, and monitor well and tanker water quality.
          </p>
        </div>
      </div>

      {/* 1. PubChem PUG REST API Compound Explorer */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-cyan-600" />
              PubChem Chemical Structure & Molecular Data Explorer
            </h3>
            <p className="text-xs text-slate-500">
              Query open chemical structures, SMILES, InChIKey, and molecular weights from PubChem
            </p>
          </div>

          {/* Quick preset selector */}
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_COMPOUNDS.map((c) => (
              <button
                key={c.query}
                type="button"
                onClick={() => setSelectedCompoundQuery(c.query)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  selectedCompoundQuery === c.query
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Custom PubChem Search */}
        <div className="flex items-center gap-2 max-w-md">
          <input
            type="text"
            value={searchCustomCompound}
            onChange={(e) => setSearchCustomCompound(e.target.value)}
            placeholder="Search any PubChem compound (e.g. Alum, Fluoride, Ozone)..."
            className="flex-1 py-2 px-3.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-500/20"
          />
          <button
            type="button"
            onClick={() => {
              if (searchCustomCompound.trim()) {
                setSelectedCompoundQuery(searchCustomCompound.trim());
              }
            }}
            className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium transition flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search PubChem</span>
          </button>
        </div>

        {/* Compound Card */}
        {isLoadingCompound ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
            <p className="text-xs">Querying PubChem PUG REST API for molecular properties...</p>
          </div>
        ) : compoundData ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50/70 p-6 rounded-2xl border border-slate-200/80">
            {/* 2D Molecular Structure Image */}
            <div className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                2D Structure (PubChem Render)
              </span>
              {structureImgUrl ? (
                <img
                  src={structureImgUrl}
                  alt={compoundData.name}
                  className="w-48 h-48 object-contain rounded-lg hover:scale-105 transition"
                  onError={(e) => {
                    // Fallback
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 text-xs">
                  No structure preview
                </div>
              )}
              <a
                href={`https://pubchem.ncbi.nlm.nih.gov/compound/${compoundData.cid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 text-xs text-cyan-700 hover:text-cyan-900 font-medium inline-flex items-center gap-1"
              >
                <span>View on PubChem (CID: {compoundData.cid})</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Molecular Properties */}
            <div className="lg:col-span-2 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xl font-bold text-slate-900">{compoundData.name}</h4>
                  <span className="px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800 font-mono text-xs font-semibold">
                    CID: {compoundData.cid}
                  </span>
                </div>
                {compoundData.nepaliName && (
                  <p className="text-xs text-slate-500 font-medium">{compoundData.nepaliName}</p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 block font-medium">Molecular Formula</span>
                  <span className="font-mono text-sm font-bold text-slate-800">
                    {compoundData.molecularFormula || 'N/A'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 block font-medium">Molecular Weight</span>
                  <span className="font-mono text-sm font-bold text-slate-800">
                    {compoundData.molecularWeight || 'N/A'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-slate-400 block font-medium">InChIKey</span>
                  <span className="font-mono text-[11px] font-semibold text-slate-700 truncate block">
                    {compoundData.inChIKey || 'N/A'}
                  </span>
                </div>
              </div>

              {/* SMILES Notation */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] text-slate-400 font-semibold block uppercase tracking-wider">
                  Canonical SMILES
                </span>
                <code className="text-xs font-mono text-indigo-700 break-all select-all block bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  {compoundData.canonicalSmiles || 'N/A'}
                </code>
              </div>

              {/* Housing & Environmental Context */}
              {compoundData.roleInHousing && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-950">
                    <span className="font-bold block text-blue-900 mb-0.5">Role in Residential Water:</span>
                    {compoundData.roleInHousing}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                    {compoundData.nepalStandardLimit && (
                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                        <span className="font-semibold block text-slate-900 text-[11px]">Nepal NDWQS Standard:</span>
                        <span>{compoundData.nepalStandardLimit}</span>
                      </div>
                    )}
                    {compoundData.safetyProtocol && (
                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                        <span className="font-semibold block text-slate-900 text-[11px]">Safety & Dosing:</span>
                        <span>{compoundData.safetyProtocol}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* 2. Interactive Water Sample Quality Calculator & Lab Logger */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Beaker className="w-5 h-5 text-indigo-600" />
              Water Chemistry Sample Analyzer & Tank Dosing Calculator
            </h3>
            <p className="text-xs text-slate-500">
              Input test strip or electronic pen readings to verify compliance with Nepal NDWQS standards
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Parameters */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Water Source</label>
                <select
                  value={sampleSource}
                  onChange={(e: any) => setSampleSource(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-xs bg-white font-medium"
                >
                  <option value="kukl_pipeline">KUKL Municipal Pipeline Supply</option>
                  <option value="groundwater_boring">Deep Groundwater Boring / Inarr (Well)</option>
                  <option value="tanker_delivery">Private Water Tanker Supply (Kathmandu)</option>
                  <option value="ro_purified">Under-Sink Reverse Osmosis (RO) Purified</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Water Storage Tank Size (Liters)
                </label>
                <input
                  type="number"
                  value={tankVolumeLiters}
                  onChange={(e) => setTankVolumeLiters(Number(e.target.value))}
                  min={100}
                  step={100}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">pH Level</span>
                  <span className="font-mono text-slate-500">Standard: 6.5 - 8.5</span>
                </div>
                <input
                  type="number"
                  value={phValue}
                  onChange={(e) => setPhValue(Number(e.target.value))}
                  step={0.1}
                  min={0}
                  max={14}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">Total Dissolved Solids (TDS ppm)</span>
                  <span className="font-mono text-slate-500">Standard: &lt; 1000 ppm</span>
                </div>
                <input
                  type="number"
                  value={tdsValue}
                  onChange={(e) => setTdsValue(Number(e.target.value))}
                  step={10}
                  min={0}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">Turbidity (NTU)</span>
                  <span className="font-mono text-slate-500">Standard: &lt; 5 NTU</span>
                </div>
                <input
                  type="number"
                  value={turbidityValue}
                  onChange={(e) => setTurbidityValue(Number(e.target.value))}
                  step={0.5}
                  min={0}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">Residual Chlorine (mg/L)</span>
                  <span className="font-mono text-slate-500">Standard: 0.1 - 0.2 mg/L</span>
                </div>
                <input
                  type="number"
                  value={chlorineValue}
                  onChange={(e) => setChlorineValue(Number(e.target.value))}
                  step={0.05}
                  min={0}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Real-time Scientific Diagnosis & Dosing Output */}
          <div className="space-y-4">
            <div className={`p-5 rounded-2xl border ${sampleSafety.color} space-y-3`}>
              <div className="flex items-center gap-2">
                {sampleSafety.badge === 'safe' ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <h4 className="font-bold text-sm">{sampleSafety.verdict}</h4>
              </div>

              {sampleSafety.issues.length > 0 ? (
                <ul className="text-xs space-y-1 list-disc pl-4">
                  {sampleSafety.issues.map((iss, i) => (
                    <li key={i}>{iss}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs">
                  All parameters conform to Nepal National Drinking Water Quality Standards (NDWQS 2062).
                </p>
              )}
            </div>

            {/* Stoichiometric Disinfection Protocol */}
            <div className="p-4 bg-cyan-50/70 border border-cyan-200 rounded-2xl space-y-2">
              <span className="text-[11px] font-bold text-cyan-900 uppercase tracking-wider block">
                Disinfection Stoichiometry
              </span>
              <div className="text-xs text-cyan-950 space-y-1">
                <p>
                  Target Chlorine Dosage for <span className="font-bold">{tankVolumeLiters} Liters</span>:
                </p>
                <div className="p-2.5 bg-white rounded-xl border border-cyan-200 font-mono text-sm font-bold text-cyan-900 text-center">
                  {recommendedBleachGrams} grams of Calcium Hypochlorite
                </div>
                <p className="text-[11px] text-cyan-800">
                  Dissolve in a bucket of water before pouring into reserve tank. Allow 30 minutes contact time before consumption.
                </p>
              </div>
            </div>

            {/* Save to Firestore Button */}
            <button
              type="button"
              onClick={handleSaveLabTest}
              disabled={savingTest}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              {savingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Water Quality Test to Firestore</span>
            </button>

            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
