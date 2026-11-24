import React, { useState } from 'react';
import {
  MapPin,
  Search,
  ExternalLink,
  Navigation,
  Compass,
  Building,
  Zap,
  Droplets,
  Wrench,
  Loader2,
  Mic,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { AudioTranscribeModal } from './AudioTranscribeModal';

interface MapLinkItem {
  title: string;
  uri: string;
  address?: string;
  distance?: string;
  type?: string;
}

export function GoogleMapsGroundingView() {
  const [searchQuery, setSearchQuery] = useState(
    'Find nearest Nepal Electricity Authority (NEA) counters and KUKL water offices near New Baneshwor, Kathmandu'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [responseResult, setResponseResult] = useState<{
    text: string;
    mapLinks: MapLinkItem[];
    modelUsed?: string;
  } | null>(null);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('Defaulting to Kathmandu Residency (27.7172° N, 85.3240° E)');

  // Geolocation lookup
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }
    setLocationStatus('Detecting precise GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocationStatus(
          `GPS active: ${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E`
        );
      },
      (err) => {
        setLocationStatus('Using Kathmandu Residency default coordinates.');
      }
    );
  };

  const handleQueryMaps = async (customQuery?: string) => {
    const q = customQuery || searchQuery;
    if (!q.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/maps/grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          userLocation: userCoords || { latitude: 27.7172, longitude: 85.3240 },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      setResponseResult({
        text: data.text || '',
        mapLinks: data.mapLinks || [],
        modelUsed: data.modelUsed || 'gemini-3.5-flash',
      });
    } catch (err: any) {
      console.error('Maps Grounding error:', err);
      setResponseResult({
        text: `Unable to retrieve live map grounding: ${err.message}. Showing local Kathmandu utility directory.`,
        mapLinks: [
          {
            title: 'NEA Baneshwor Distribution Center',
            uri: 'https://maps.google.com/?q=NEA+Baneshwor+Distribution+Center+Kathmandu',
            address: 'New Baneshwor, Kathmandu',
          },
          {
            title: 'KUKL Mahankalchaur / Baneshwor Branch',
            uri: 'https://maps.google.com/?q=KUKL+Water+Branch+Kathmandu',
            address: 'Mid Baneshwor Road, Kathmandu',
          },
        ],
        modelUsed: 'directory_fallback',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const presetQueries = [
    {
      label: 'NEA Electricity Counters',
      icon: Zap,
      query: 'Find Nepal Electricity Authority (NEA) bill counters and customer service branches near Baneshwor, Kathmandu',
    },
    {
      label: 'KUKL Water Supply Branches',
      icon: Droplets,
      query: 'Locate Kathmandu Upatyaka Khanepani Limited (KUKL) water supply offices and meter inspection centers in Kathmandu',
    },
    {
      label: 'Emergency Plumbing Hardware',
      icon: Wrench,
      query: 'Find plumbing, sanitary hardware, and sub-meter pipe supply shops near New Baneshwor Kathmandu',
    },
    {
      label: 'Ward & Sanitation Centers',
      icon: Building,
      query: 'Locate Kathmandu Metropolitan City Ward 10 Office and waste collection centers',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-indigo-800 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold tracking-wide">
            <Compass className="w-3.5 h-3.5 text-emerald-300" />
            Maps Grounding via gemini-3.5-flash
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Kathmandu Neighborhood & Utility Map Navigator
          </h2>
          <p className="text-sm text-emerald-100/90 leading-relaxed">
            Real-time geospatial intelligence grounded with Google Maps. Quickly locate nearby NEA electricity bill counters, KUKL municipal water depots, plumbing emergency shops, and ward sanitation centers.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-emerald-200">
            <button
              type="button"
              onClick={handleDetectLocation}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center gap-1.5 transition text-white"
            >
              <Navigation className="w-3.5 h-3.5" />
              Detect My GPS
            </button>
            <span className="text-white/80">{locationStatus}</span>
          </div>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {presetQueries.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSearchQuery(item.query);
                handleQueryMaps(item.query);
              }}
              className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition text-left space-y-2 group"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition">
                <Icon className="w-5 h-5" />
              </div>
              <div className="font-semibold text-xs text-slate-800">{item.label}</div>
              <div className="text-[11px] text-slate-500 line-clamp-1">{item.query}</div>
            </button>
          );
        })}
      </div>

      {/* Search Input Box */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleQueryMaps();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search utility offices, hardware supply stores, or clinics grounded in Kathmandu Maps..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              disabled={isLoading}
            />
          </div>

          <button
            type="button"
            onClick={() => setIsAudioModalOpen(true)}
            className="p-3 rounded-xl border border-slate-200 text-slate-700 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition"
            title="Voice query (gemini-3.5-transcribe)"
          >
            <Mic className="w-5 h-5" />
          </button>

          <button
            type="submit"
            disabled={!searchQuery.trim() || isLoading}
            className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center gap-2 shadow-sm transition disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            <span>Locate on Maps</span>
          </button>
        </form>
      </div>

      {/* Results View */}
      {responseResult && (
        <div className="space-y-6">
          {/* AI Grounded Summary */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Grounded Information Response
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono text-[10px] font-medium border border-emerald-200">
                {responseResult.modelUsed || 'gemini-3.5-flash (with googleMaps tool)'}
              </span>
            </div>

            <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line font-sans">
              {responseResult.text}
            </div>
          </div>

          {/* Extracted Google Maps Links & Verified Place Cards (Mandatory per spec) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Verified Google Maps Places & Navigation Links
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {responseResult.mapLinks.length} locations found
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {responseResult.mapLinks.map((place, idx) => (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-emerald-500 hover:shadow-md transition flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition">
                        {place.title}
                      </h4>
                      <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                        <MapPin className="w-4 h-4" />
                      </span>
                    </div>

                    {place.address && (
                      <p className="text-xs text-slate-600 flex items-center gap-1">
                        <span className="text-slate-400">Address:</span> {place.address}
                      </p>
                    )}

                    {place.type && (
                      <span className="inline-block text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                        {place.type}
                      </span>
                    )}
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Google Maps Grounding Verified</span>
                    <a
                      href={place.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition"
                    >
                      <span>Open on Google Maps</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Audio Modal */}
      <AudioTranscribeModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        onTranscriptionComplete={(text) => {
          setSearchQuery(text);
          handleQueryMaps(text);
        }}
        title="Voice Search for Maps"
        subtitle="Speak your neighborhood query. Transcribed via gemini-3.5-transcribe."
      />
    </div>
  );
}
